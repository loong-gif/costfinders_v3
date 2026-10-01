'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { PUBLIC_OFFERS, resolveOfferTitle } from '@/lib/data/offers'
import { notifyOwnerOfNewMessage } from '@/lib/email/ownerNotifications'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'
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

/**
 * Returned when a claim's business has no owner account, so no second party exists to hold a
 * conversation. A module with 'use server' may only export async functions, so this is a
 * literal rather than an exported constant; keep the two in step.
 */
const NO_BUSINESS_OWNER_ERROR = 'This business has not joined CostFinders yet.'

/** Default number of messages to fetch per conversation. */
const DEFAULT_MESSAGE_LIMIT = 100

/** The owner gets at most one new-message email per conversation in this window. */
const OWNER_EMAIL_THROTTLE_MS = 60 * 60 * 1000

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
 * Get or create the conversation for a claim.
 *
 * Delegates to `get_or_create_claim_conversation` (migration 20260910040002) because neither
 * party can resolve the other from the client's own privileges: a consumer cannot read
 * `business_profiles` (its only non-admin SELECT policy is `auth.uid() = id`), which is why
 * this action used to fail on every call with 'Business owner profile not found for this
 * claim.' and `conversations` sat at 0 rows. The function refuses anyone who is not a party.
 *
 * Returns `success: false` with NO_BUSINESS_OWNER_ERROR when the business has no owner
 * account — the honest answer for 418 of 419 businesses, and not an error to alarm anyone
 * with.
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

    const { data, error } = await supabase.rpc(
      'get_or_create_claim_conversation',
      { p_claim_id: claimId },
    )

    if (error) {
      logSupabaseError('getOrCreateConversationAction', error, {
        userId: user.id,
        claimId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't open this conversation. Please try again.",
        ),
      }
    }

    // A composite-returning function that returns SQL NULL comes back from PostgREST as an
    // object with every field null — `{"id":null,"claim_id":null,…}` — not as `null`. Verified
    // live. So the emptiness test is the id, not the object; `if (!data)` would have handed
    // the UI a conversation with a null id and reopened the dead-thread bug from the other end.
    const conversation = data as ConversationRow | null
    if (!conversation?.id) {
      return { success: false, error: NO_BUSINESS_OWNER_ERROR }
    }

    return { success: true, conversation }
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
    const roleColumn = role === 'business' ? 'business_owner_id' : 'consumer_id'

    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq(roleColumn, user.id)
      .order('last_message_at', { ascending: false, nullsFirst: false })

    if (convError) {
      logSupabaseError('getConversationsAction', convError, {
        userId: user.id,
      })
      return {
        success: false,
        error: publicErrorMessage(
          convError,
          "We couldn't load your messages. Please try again.",
        ),
      }
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

        // The deal title: the claim's own snapshot (every claim since 20260924010001 has one),
        // else the live offer through the public catalogue. A customer has no read on
        // promo_offer_master since 20260924050002.
        let dealTitle: string | null = null
        const { data: claim } = await supabase
          .from('claims')
          .select('deal_id, deal_title')
          .eq('id', conv.claim_id)
          .single()

        if (claim?.deal_title) {
          dealTitle = claim.deal_title
        } else if (claim) {
          const { data: offer } = await supabase
            .from(PUBLIC_OFFERS)
            .select('offer_raw_text, promo_offer_items')
            .eq('id', claim.deal_id)
            .maybeSingle()

          dealTitle = offer ? resolveOfferTitle(offer) : null
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
      logSupabaseError('getMessagesAction', error, {
        userId: user.id,
        conversationId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load this conversation. Please try again.",
        ),
      }
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
      .select(
        'claim_id, consumer_id, business_owner_id, status, last_message_at',
      )
      .eq('id', conversationId)
      .single()

    if (convError)
      logSupabaseError('sendMessageAction', convError, {
        userId: user.id,
        conversationId,
      })
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
      logSupabaseError('sendMessageAction', insertError, {
        userId: user.id,
        conversationId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          insertError,
          "We couldn't send your message. Please try again.",
        ),
      }
    }

    // Update conversation's last_message_at
    await supabase
      .from('conversations')
      .update({
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', conversationId)

    // Email the owner about a customer's message, read before this insert moved it.
    // ponytail: last_message_at moves on either party's message, so an owner already replying
    // within the hour gets no email, and a customer's follow-ups inside the hour ride on the
    // first one. A per-conversation "last emailed at" column is the upgrade if that misses mail.
    // Today this is a no-op: the owner's address is answered only to an admin or service_role,
    // never to the consumer sending this (see src/lib/email/ownerNotifications.ts).
    const lastActivity = conv.last_message_at
      ? new Date(conv.last_message_at).getTime()
      : 0
    if (
      senderType === 'consumer' &&
      Date.now() - lastActivity > OWNER_EMAIL_THROTTLE_MS
    ) {
      after(() => notifyOwnerOfNewMessage(conv.claim_id))
    }

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

    if (convError)
      logSupabaseError('markMessagesReadAction', convError, {
        userId: user.id,
        conversationId,
      })
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
      logSupabaseError('markMessagesReadAction', updateError, {
        userId: user.id,
        conversationId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          updateError,
          "We couldn't mark these messages as read.",
        ),
      }
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
      logSupabaseError('archiveConversationAction', error, {
        userId: user.id,
        conversationId,
      })
      if (error.code === 'PGRST116') {
        return {
          success: false,
          error: 'Conversation not found or not authorized.',
        }
      }
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't archive this conversation. Please try again.",
        ),
      }
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
