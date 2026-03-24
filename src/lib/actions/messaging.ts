'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'
import type {
  ConversationRow,
  ConversationWithPreview,
  MessageRow,
} from '@/types/messaging'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationResult {
  success: boolean
  error?: string
  conversation?: ConversationRow
}

interface ConversationsListResult {
  success: boolean
  error?: string
  conversations?: ConversationWithPreview[]
}

interface MessagesListResult {
  success: boolean
  error?: string
  messages?: MessageRow[]
}

interface MessageResult {
  success: boolean
  error?: string
  message?: MessageRow
}

interface MutationResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum allowed message content length in characters. */
const MAX_CONTENT_LENGTH = 2000

/** Default number of messages to fetch per conversation. */
const DEFAULT_MESSAGE_LIMIT = 100

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Get or create a conversation for a given claim.
 *
 * If a conversation already exists for the claim, it is returned directly.
 * Otherwise, a new conversation is created by resolving the business owner
 * from the claim's business_id via business_profiles.
 */
export async function getOrCreateConversationAction(
  claimId: string,
): Promise<ConversationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if conversation already exists for this claim
    const { data: existing, error: existingError } = await supabase
      .from('conversations')
      .select('*')
      .eq('claim_id', claimId)
      .maybeSingle()

    if (existingError) {
      return { success: false, error: existingError.message }
    }

    if (existing) {
      return { success: true, conversation: existing as ConversationRow }
    }

    // Get claim details to resolve participants
    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('consumer_id, business_id')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      return { success: false, error: 'Claim not found.' }
    }

    // Resolve business_owner_id from business_profiles
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('id')
      .eq('business_id', claim.business_id)
      .single()

    if (profileError || !profile) {
      return {
        success: false,
        error: 'Business owner profile not found for this claim.',
      }
    }

    // Verify the current user is a participant (consumer or business owner)
    if (user.id !== claim.consumer_id && user.id !== profile.id) {
      return { success: false, error: 'Not authorized for this claim.' }
    }

    // Create the conversation
    const { data: conversation, error: insertError } = await supabase
      .from('conversations')
      .insert({
        claim_id: claimId,
        consumer_id: claim.consumer_id,
        business_owner_id: profile.id,
      })
      .select()
      .single()

    if (insertError) {
      // Handle race condition: conversation created between check and insert
      if (insertError.code === '23505') {
        const { data: raced, error: racedError } = await supabase
          .from('conversations')
          .select('*')
          .eq('claim_id', claimId)
          .single()

        if (racedError || !raced) {
          return { success: false, error: 'Failed to create conversation.' }
        }

        return { success: true, conversation: raced as ConversationRow }
      }
      return { success: false, error: insertError.message }
    }

    return { success: true, conversation: conversation as ConversationRow }
  } catch (error) {
    logger.error('getOrCreateConversationAction failed', {
      action: 'getOrCreateConversationAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch all conversations for the current user with preview data.
 *
 * Includes last message content, unread count, and deal title for each
 * conversation. Results are ordered by most recent activity.
 */
export async function getConversationsAction(
  role: 'business' | 'consumer',
): Promise<ConversationsListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Fetch conversations for the user's role
    const roleColumn =
      role === 'business' ? 'business_owner_id' : 'consumer_id'

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq(roleColumn, user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convError) {
      return { success: false, error: convError.message }
    }

    if (!conversations || conversations.length === 0) {
      return { success: true, conversations: [] }
    }

    // Build preview data for each conversation
    const previews: ConversationWithPreview[] = await Promise.all(
      conversations.map(async (conv) => {
        // Get last message
        const { data: lastMsg } = await supabase
          .from('messages')
          .select('content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        // Get unread count (messages from the OTHER party that are unread)
        const otherSenderType = role === 'business' ? 'consumer' : 'business'
        const { count: unreadCount } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .eq('sender_type', otherSenderType)
          .is('read_at', null)

        // Get deal title via claim -> promo_offer_master
        let dealTitle: string | null = null
        const { data: claim } = await supabase
          .from('claims')
          .select('deal_id')
          .eq('id', conv.claim_id)
          .single()

        if (claim) {
          const { data: offer } = await supabase
            .from('promo_offer_master')
            .select('service_name')
            .eq('id', claim.deal_id)
            .single()

          dealTitle = offer?.service_name ?? null
        }

        return {
          id: conv.id,
          claim_id: conv.claim_id,
          consumer_id: conv.consumer_id,
          business_owner_id: conv.business_owner_id,
          status: conv.status,
          last_message_at: conv.last_message_at,
          last_message: lastMsg?.content ?? null,
          unread_count: unreadCount ?? 0,
          deal_title: dealTitle,
          other_party_name: null, // MVP: requires auth.users access
          created_at: conv.created_at,
        } satisfies ConversationWithPreview
      }),
    )

    return { success: true, conversations: previews }
  } catch (error) {
    logger.error('getConversationsAction failed', {
      action: 'getConversationsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Fetch messages for a conversation, ordered chronologically.
 *
 * RLS ensures only conversation participants can read messages.
 */
export async function getMessagesAction(
  conversationId: string,
  limit?: number,
): Promise<MessagesListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(limit ?? DEFAULT_MESSAGE_LIMIT)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, messages: (data ?? []) as MessageRow[] }
  } catch (error) {
    logger.error('getMessagesAction failed', {
      action: 'getMessagesAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Send a message in a conversation.
 *
 * Determines sender_type by checking if the user is the consumer or
 * business owner on the conversation. Content is sanitized and validated.
 */
export async function sendMessageAction(
  conversationId: string,
  content: string,
): Promise<MessageResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Validate content
    const sanitized = stripHtml(content.trim())
    if (sanitized.length === 0) {
      return { success: false, error: 'Message content cannot be empty.' }
    }
    if (sanitized.length > MAX_CONTENT_LENGTH) {
      return {
        success: false,
        error: `Message cannot exceed ${MAX_CONTENT_LENGTH} characters.`,
      }
    }

    // Get conversation to determine sender_type
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('consumer_id, business_owner_id, status')
      .eq('id', conversationId)
      .single()

    if (convError || !conv) {
      return { success: false, error: 'Conversation not found.' }
    }

    if (conv.status === 'archived') {
      return { success: false, error: 'This conversation has been archived.' }
    }

    // Determine sender type
    let senderType: 'business' | 'consumer'
    if (user.id === conv.consumer_id) {
      senderType = 'consumer'
    } else if (user.id === conv.business_owner_id) {
      senderType = 'business'
    } else {
      return { success: false, error: 'Not authorized for this conversation.' }
    }

    // Insert message
    const { data: message, error: insertError } = await supabase
      .from('messages')
      .insert({
        conversation_id: conversationId,
        sender_id: user.id,
        sender_type: senderType,
        content: sanitized,
      })
      .select()
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // Update conversation's last_message_at
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    revalidatePath('/dashboard/messages')
    revalidatePath('/business/dashboard/messages')

    return { success: true, message: message as MessageRow }
  } catch (error) {
    logger.error('sendMessageAction failed', {
      action: 'sendMessageAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Mark all unread messages from the other party as read.
 *
 * Only marks messages where sender_type differs from the current user's role
 * in the conversation (i.e., messages the user received, not sent).
 */
export async function markMessagesReadAction(
  conversationId: string,
): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Get conversation to determine current user's role
    const { data: conv, error: convError } = await supabase
      .from('conversations')
      .select('consumer_id, business_owner_id')
      .eq('id', conversationId)
      .single()

    if (convError || !conv) {
      return { success: false, error: 'Conversation not found.' }
    }

    // Determine the sender_type of messages to mark as read
    // (messages from the OTHER party)
    let otherSenderType: 'business' | 'consumer'
    if (user.id === conv.consumer_id) {
      otherSenderType = 'business'
    } else if (user.id === conv.business_owner_id) {
      otherSenderType = 'consumer'
    } else {
      return { success: false, error: 'Not authorized for this conversation.' }
    }

    const { error: updateError } = await supabase
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('sender_type', otherSenderType)
      .is('read_at', null)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('markMessagesReadAction failed', {
      action: 'markMessagesReadAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Archive a conversation. Only the business owner can archive.
 */
export async function archiveConversationAction(
  conversationId: string,
): Promise<MutationResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({
        status: 'archived',
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)
      .eq('business_owner_id', user.id)
      .select('id')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Conversation not found or not authorized.',
        }
      }
      return { success: false, error: error.message }
    }

    if (!data) {
      return {
        success: false,
        error: 'Conversation not found or not authorized.',
      }
    }

    revalidatePath('/business/dashboard/messages')

    return { success: true }
  } catch (error) {
    logger.error('archiveConversationAction failed', {
      action: 'archiveConversationAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
