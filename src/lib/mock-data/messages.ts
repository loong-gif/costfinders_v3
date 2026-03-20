import type { Claim } from '@/types/claim'
import type { Message } from '@/types/message'
import { getClaimsForBusiness } from './consumers'
import { getDealById } from './deals'

// Seeded mock messages (2-3 conversations)
const initialMessages: Message[] = [
  // Conversation for claim-1 (completed Botox claim)
  {
    id: 'msg-1',
    claimId: 'claim-1',
    senderId: 'user-1',
    senderType: 'consumer',
    content: "Hi! I'm interested in the Botox deal. Is it still available?",
    createdAt: '2024-02-01T11:05:00Z',
    readAt: '2024-02-01T11:10:00Z',
  },
  {
    id: 'msg-2',
    claimId: 'claim-1',
    senderId: 'biz-1',
    senderType: 'business',
    content:
      "Hello Sarah! Yes, the deal is available. We'd love to have you in. First time getting Botox? We'll make sure you're comfortable!",
    createdAt: '2024-02-01T12:00:00Z',
    readAt: '2024-02-01T12:30:00Z',
  },
  {
    id: 'msg-3',
    claimId: 'claim-1',
    senderId: 'user-1',
    senderType: 'consumer',
    content:
      "Yes, first time! I'm a bit nervous. How long does the appointment take?",
    createdAt: '2024-02-01T12:35:00Z',
    readAt: '2024-02-01T13:00:00Z',
  },
  {
    id: 'msg-4',
    claimId: 'claim-1',
    senderId: 'biz-1',
    senderType: 'business',
    content:
      "No worries at all! The procedure typically takes 15-20 minutes. We'll do a consultation first to discuss your goals. Does February 15th at 10:30 AM work for you?",
    createdAt: '2024-02-01T13:15:00Z',
    readAt: '2024-02-01T14:00:00Z',
  },
  {
    id: 'msg-5',
    claimId: 'claim-1',
    senderId: 'user-1',
    senderType: 'consumer',
    content: "That works! I'll see you then. Thank you!",
    createdAt: '2024-02-01T14:05:00Z',
    readAt: '2024-02-01T14:10:00Z',
  },

  // Conversation for claim-4 (contacted status)
  {
    id: 'msg-6',
    claimId: 'claim-4',
    senderId: 'user-2',
    senderType: 'consumer',
    content:
      'Hello, I saw your facial deal and would like to book an appointment.',
    createdAt: '2024-03-15T09:05:00Z',
    readAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'msg-7',
    claimId: 'claim-4',
    senderId: 'biz-5',
    senderType: 'business',
    content:
      "Hi Mike! Thanks for reaching out. We have openings on the 18th. What time works best for you - morning or afternoon?",
    createdAt: '2024-03-16T11:00:00Z',
  },

  // Conversation for claim-2 (booked status)
  {
    id: 'msg-8',
    claimId: 'claim-2',
    senderId: 'user-1',
    senderType: 'consumer',
    content: 'Hi! I claimed the laser hair removal deal. When can I come in?',
    createdAt: '2024-03-15T15:05:00Z',
    readAt: '2024-03-15T16:00:00Z',
  },
  {
    id: 'msg-9',
    claimId: 'claim-2',
    senderId: 'biz-4',
    senderType: 'business',
    content:
      "Hello! We have March 20th at 2 PM available. Does that work for you?",
    createdAt: '2024-03-15T16:30:00Z',
    readAt: '2024-03-15T17:00:00Z',
  },
  {
    id: 'msg-10',
    claimId: 'claim-2',
    senderId: 'user-1',
    senderType: 'consumer',
    content: 'Yes! Please book me for that slot.',
    createdAt: '2024-03-15T17:05:00Z',
    readAt: '2024-03-15T17:30:00Z',
  },
  {
    id: 'msg-11',
    claimId: 'claim-2',
    senderId: 'biz-4',
    senderType: 'business',
    content:
      "You're all set for March 20th at 2 PM! See you then. Please arrive 10 minutes early.",
    createdAt: '2024-03-16T10:00:00Z',
    readAt: '2024-03-16T10:30:00Z',
  },
]

// Track dynamically created messages (changes during session)
let dynamicMessages: Message[] = []

// Initialize dynamic array on first access
function getDynamicMessages(): Message[] {
  if (dynamicMessages.length === 0) {
    dynamicMessages = [...initialMessages]
  }
  return dynamicMessages
}

/**
 * Get all messages for a specific claim
 */
export function getMessagesForClaim(claimId: string): Message[] {
  return getDynamicMessages()
    .filter((m) => m.claimId === claimId)
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
}

/**
 * Send a new message for a claim
 */
export function sendMessage(
  claimId: string,
  content: string,
  senderType: 'business' | 'consumer',
  senderId: string
): Message {
  const messages = getDynamicMessages()
  const newMessage: Message = {
    id: `msg-${Date.now()}`,
    claimId,
    senderId,
    senderType,
    content,
    createdAt: new Date().toISOString(),
  }

  messages.push(newMessage)
  return newMessage
}

/**
 * Get the last message for a claim
 */
export function getLastMessageForClaim(claimId: string): Message | undefined {
  const messages = getMessagesForClaim(claimId)
  return messages[messages.length - 1]
}

/**
 * Get unread message count for a claim (from business perspective)
 */
export function getUnreadCountForClaim(claimId: string): number {
  return getDynamicMessages().filter(
    (m) => m.claimId === claimId && m.senderType === 'consumer' && !m.readAt
  ).length
}

/**
 * Mark messages as read
 */
export function markMessagesAsRead(
  claimId: string,
  readerType: 'business' | 'consumer'
): void {
  const messages = getDynamicMessages()
  const oppositeType = readerType === 'business' ? 'consumer' : 'business'

  for (const message of messages) {
    if (
      message.claimId === claimId &&
      message.senderType === oppositeType &&
      !message.readAt
    ) {
      message.readAt = new Date().toISOString()
    }
  }
}

/**
 * Get all unique claim IDs that have messages (for conversation list)
 */
export function getClaimIdsWithMessages(): string[] {
  const claimIds = new Set<string>()
  for (const message of getDynamicMessages()) {
    claimIds.add(message.claimId)
  }
  return Array.from(claimIds)
}

export interface ConversationSummary {
  claim: Claim
  dealTitle: string
  lastMessage: Message
  unreadCount: number
}

/**
 * Get all conversations for a business (claims that have messages)
 */
export function getConversationsForBusiness(
  businessId: string
): ConversationSummary[] {
  const businessClaims = getClaimsForBusiness(businessId)
  const claimIdsWithMessages = getClaimIdsWithMessages()

  const conversations: ConversationSummary[] = []

  for (const claim of businessClaims) {
    if (claimIdsWithMessages.includes(claim.id)) {
      const lastMessage = getLastMessageForClaim(claim.id)
      if (lastMessage) {
        const deal = getDealById(claim.dealId)
        conversations.push({
          claim,
          dealTitle: deal?.title ?? 'Unknown Deal',
          lastMessage,
          unreadCount: getUnreadCountForClaim(claim.id),
        })
      }
    }
  }

  // Sort by most recent message
  return conversations.sort(
    (a, b) =>
      new Date(b.lastMessage.createdAt).getTime() -
      new Date(a.lastMessage.createdAt).getTime()
  )
}
