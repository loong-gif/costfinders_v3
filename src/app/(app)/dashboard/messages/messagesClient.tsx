'use client'

import {
  ArrowLeft,
  ChatCircle,
  EnvelopeSimple,
  MagnifyingGlass,
  Tag,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { MessageThread } from '@/components/features/messaging/messageThread'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/lib/context/authContext'
import type { ConversationWithPreview } from '@/types/messaging'

type FilterTab = 'all' | 'unread'

/** Polling interval for refreshing the conversation list (ms). */
const POLL_INTERVAL = 10_000

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffHours < 1) return 'Just now'
  if (diffHours < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) {
    return date.toLocaleDateString('en-US', { weekday: 'short' })
  }
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function truncateMessage(message: string, maxLength = 60): string {
  if (message.length <= maxLength) return message
  return `${message.slice(0, maxLength)}...`
}

export function MessagesClient({
  initialConversations = [],
}: {
  initialConversations?: ConversationWithPreview[]
}) {
  const { state } = useAuth()
  const userId = state.user?.id

  const [conversations, setConversations] =
    useState<ConversationWithPreview[]>(initialConversations)
  const [isLoading, setIsLoading] = useState(initialConversations.length === 0)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const [selectedClaimId, setSelectedClaimId] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const { getConversationsAction } = await import('@/lib/actions/messaging')
      const result = await getConversationsAction('consumer')
      if (result.success && result.conversations) {
        setConversations(result.conversations)
      }
    } catch {
      // Server actions may not be available yet — fail silently
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    if (initialConversations.length === 0) {
      fetchConversations()
    }

    pollRef.current = setInterval(fetchConversations, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations, initialConversations.length])

  // ---------- Filtering ----------

  let filtered = conversations
  if (activeTab === 'unread') {
    filtered = conversations.filter((c) => c.unread_count > 0)
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter((c) => c.deal_title?.toLowerCase().includes(q))
  }

  const unreadCount = conversations.filter((c) => c.unread_count > 0).length

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: conversations.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ]

  // ---------- Selected thread view ----------

  if (selectedConversationId && selectedClaimId && userId) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => {
            setSelectedConversationId(null)
            setSelectedClaimId(null)
          }}
          className="inline-flex items-center gap-1.5 text-sm text-[#78350f] hover:text-[#451a03] transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back to messages
        </button>

        <MessageThread
          claimId={selectedClaimId}
          currentUserId={userId}
          currentUserType="consumer"
        />
      </div>
    )
  }

  // ---------- Loading state ----------

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-[#f2ebe2] animate-pulse" />
        ))}
      </div>
    )
  }

  // ---------- Conversation list ----------

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <MagnifyingGlass
            size={20}
            weight="regular"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-[#92400e]"
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] placeholder:text-[#92400e] focus:outline-none focus:border-amber-800/40 focus:ring-2 focus:ring-amber-800/15 transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-amber-800 text-white'
                  : 'bg-[#f2ebe2] border border-[#d4c4b0] text-[#78350f] hover:bg-[#faf5ee]'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
                      : 'bg-[#faf5ee] text-[#92400e]'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Conversations List */}
      {filtered.length === 0 ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-[#f2ebe2] mx-auto mb-4 flex items-center justify-center">
              <EnvelopeSimple
                size={32}
                weight="light"
                className="text-[#92400e]"
              />
            </div>
            <h3 className="text-lg font-semibold text-[#451a03] mb-2">
              {searchQuery
                ? 'No conversations found'
                : activeTab === 'unread'
                  ? 'No unread messages'
                  : 'No messages yet'}
            </h3>
            <p className="text-[#78350f] text-sm mb-6">
              {searchQuery
                ? 'Try adjusting your search terms'
                : activeTab === 'unread'
                  ? "You're all caught up!"
                  : 'When you claim a deal, you can message the business here'}
            </p>
            {!searchQuery && activeTab === 'all' && (
              <Link href="/deals">
                <Button variant="primary" size="md">
                  <MagnifyingGlass size={18} weight="bold" />
                  Browse deals
                </Button>
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card
          variant="glass"
          padding="none"
          className="divide-y divide-[#d4c4b0]"
        >
          {filtered.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              onSelect={() => {
                setSelectedConversationId(conversation.id)
                setSelectedClaimId(conversation.claim_id)
              }}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Conversation row component
// ---------------------------------------------------------------------------

function ConversationItem({
  conversation,
  onSelect,
}: {
  conversation: ConversationWithPreview
  onSelect: () => void
}) {
  const hasUnread = conversation.unread_count > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left hover:bg-[#d4c4b0]/30 transition-colors"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar / Icon */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-amber-800/8 flex items-center justify-center">
            <ChatCircle size={24} weight="fill" className="text-amber-800" />
          </div>
          {hasUnread && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-800 text-white text-xs font-semibold flex items-center justify-center">
              {conversation.unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`font-medium truncate ${hasUnread ? 'text-[#451a03]' : 'text-[#78350f]'}`}
            >
              {conversation.other_party_name ?? 'Business'}
            </span>
            {conversation.last_message_at && (
              <span className="text-xs text-[#92400e] flex-shrink-0">
                {formatMessageTime(conversation.last_message_at)}
              </span>
            )}
          </div>

          {conversation.deal_title && (
            <div className="flex items-center gap-2 mb-1.5">
              <Tag
                size={14}
                weight="fill"
                className="text-[#92400e] flex-shrink-0"
              />
              <span className="text-sm text-[#92400e] truncate">
                {conversation.deal_title}
              </span>
            </div>
          )}

          {conversation.last_message && (
            <div className="flex items-start gap-2">
              <ChatCircle
                size={14}
                weight={hasUnread ? 'fill' : 'regular'}
                className={`flex-shrink-0 mt-0.5 ${hasUnread ? 'text-amber-800' : 'text-[#92400e]'}`}
              />
              <p
                className={`text-sm truncate ${hasUnread ? 'text-[#451a03] font-medium' : 'text-[#92400e]'}`}
              >
                {truncateMessage(conversation.last_message ?? '')}
              </p>
            </div>
          )}
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          <Badge variant={hasUnread ? 'brand' : 'default'} size="sm">
            {hasUnread ? 'New' : 'Open'}
          </Badge>
        </div>
      </div>
    </button>
  )
}
