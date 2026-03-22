'use client'

import {
  ChatCircle,
  EnvelopeSimple,
  MagnifyingGlass,
  SpinnerGap,
  Tag,
  User,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getConversationsAction } from '@/lib/actions/messaging'
import type { ConversationWithPreview } from '@/types/messaging'

type FilterTab = 'all' | 'unread'

const POLL_INTERVAL = 10_000 // 10 seconds

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

function getCustomerDisplay(consumerId: string): string {
  const num = consumerId.replace(/\D/g, '')
  return `Customer #${num || consumerId.slice(-3)}`
}

function truncateMessage(message: string, maxLength: number = 60): string {
  if (message.length <= maxLength) return message
  return `${message.slice(0, maxLength)}...`
}

export default function MessagesPage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [conversations, setConversations] = useState<ConversationWithPreview[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchConversations = useCallback(async (showLoading = false) => {
    if (showLoading) setIsLoading(true)
    try {
      const result = await getConversationsAction('business')
      if (result.success && result.conversations) {
        setConversations(result.conversations)
        setError(null)
      } else {
        setError('Failed to load conversations')
      }
    } catch {
      setError('Failed to load conversations')
    } finally {
      if (showLoading) setIsLoading(false)
    }
  }, [])

  // Initial fetch + polling
  useEffect(() => {
    fetchConversations(true)

    pollRef.current = setInterval(() => {
      fetchConversations(false)
    }, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations])

  if (!businessId) {
    return (
      <div className="text-center py-12">
        <p className="text-[#78350f]">No business linked to your account.</p>
      </div>
    )
  }

  // Filter by tab
  let filteredConversations = conversations
  if (activeTab === 'unread') {
    filteredConversations = conversations.filter((c) => c.unread_count > 0)
  }

  // Filter by search
  if (searchQuery) {
    const query = searchQuery.toLowerCase()
    filteredConversations = filteredConversations.filter(
      (c) =>
        c.deal_title.toLowerCase().includes(query) ||
        getCustomerDisplay(c.consumer_id).toLowerCase().includes(query),
    )
  }

  const unreadCount = conversations.filter((c) => c.unread_count > 0).length

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: conversations.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ]

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
                      ? 'bg-[#faf5ee] text-white'
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

      {/* Loading State */}
      {isLoading ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <SpinnerGap
              size={32}
              weight="light"
              className="text-[#92400e] animate-spin mx-auto mb-4"
            />
            <p className="text-[#78350f] text-sm">Loading conversations...</p>
          </div>
        </Card>
      ) : error ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-red-50 mx-auto mb-4 flex items-center justify-center">
              <EnvelopeSimple
                size={32}
                weight="light"
                className="text-red-400"
              />
            </div>
            <h3 className="text-lg font-semibold text-[#451a03] mb-2">
              Something went wrong
            </h3>
            <p className="text-[#78350f] text-sm">{error}</p>
          </div>
        </Card>
      ) : filteredConversations.length === 0 ? (
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
                  : 'No conversations yet'}
            </h3>
            <p className="text-[#78350f] text-sm">
              {searchQuery
                ? 'Try adjusting your search terms'
                : activeTab === 'unread'
                  ? "You're all caught up!"
                  : 'Conversations will appear here when customers message you'}
            </p>
          </div>
        </Card>
      ) : (
        <Card
          variant="glass"
          padding="none"
          className="divide-y divide-[#d4c4b0]"
        >
          {filteredConversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </Card>
      )}
    </div>
  )
}

function ConversationRow({
  conversation,
}: {
  conversation: ConversationWithPreview
}) {
  const {
    deal_title,
    last_message,
    last_message_at,
    last_message_sender_type,
    unread_count,
    consumer_id,
    claim_id,
    claim_status,
  } = conversation
  const hasUnread = unread_count > 0

  return (
    <Link
      href={`/business/dashboard/leads/${claim_id}`}
      className="block hover:bg-[#d4c4b0]/30 transition-colors"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-amber-800/8 flex items-center justify-center">
            <User size={24} weight="fill" className="text-amber-800" />
          </div>
          {hasUnread && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-amber-800 text-white text-xs font-semibold flex items-center justify-center">
              {unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`font-medium truncate ${hasUnread ? 'text-[#451a03]' : 'text-[#78350f]'}`}
            >
              {getCustomerDisplay(consumer_id)}
            </span>
            <span className="text-xs text-[#92400e] flex-shrink-0">
              {formatMessageTime(last_message_at)}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <Tag
              size={14}
              weight="fill"
              className="text-[#92400e] flex-shrink-0"
            />
            <span className="text-sm text-[#92400e] truncate">
              {deal_title}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <ChatCircle
              size={14}
              weight={hasUnread ? 'fill' : 'regular'}
              className={`flex-shrink-0 mt-0.5 ${hasUnread ? 'text-amber-800' : 'text-[#92400e]'}`}
            />
            <p
              className={`text-sm truncate ${hasUnread ? 'text-[#451a03] font-medium' : 'text-[#92400e]'}`}
            >
              {last_message_sender_type === 'business' && (
                <span className="text-[#92400e]">You: </span>
              )}
              {truncateMessage(last_message)}
            </p>
          </div>
        </div>

        {/* Status Badge */}
        <div className="flex-shrink-0">
          <Badge
            variant={
              claim_status === 'completed'
                ? 'success'
                : claim_status === 'cancelled'
                  ? 'error'
                  : claim_status === 'booked'
                    ? 'info'
                    : 'default'
            }
            size="sm"
          >
            {claim_status.charAt(0).toUpperCase() + claim_status.slice(1)}
          </Badge>
        </div>
      </div>
    </Link>
  )
}
