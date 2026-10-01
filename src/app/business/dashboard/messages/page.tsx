'use client'

import {
  ArrowClockwise,
  ChatCircle,
  EnvelopeSimple,
  MagnifyingGlass,
  SpinnerGap,
  Tag,
  User,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { getConversationsAction } from '@/lib/actions/messaging'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import type { ConversationWithPreview } from '@/types/messaging'

type FilterTab = 'all' | 'unread'

/**
 * The open thread is live (public.messages joined the supabase_realtime publication in
 * migration 20260910040003), so this poll only refreshes the LIST previews and unread counts.
 * Each tick costs 1 + 3N queries — messaging.ts runs a last-message, unread-count, claim and
 * offer query per conversation — so it runs a minute apart and skips a backgrounded tab.
 */
const POLL_INTERVAL = 60_000

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

// Matches the label used on the leads screens so the same person reads the
// same way in both places.
function getCustomerDisplay(consumerId: string): string {
  return `Customer #${consumerId.slice(-4).toUpperCase()}`
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
      if (document.visibilityState === 'visible') fetchConversations(false)
    }, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations])

  // The dashboard layout renders its own screen for an account with no approved business, so
  // this only covers the render before the owner loads.
  if (!businessId) return null

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
        (c.deal_title ?? '').toLowerCase().includes(query) ||
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full min-h-[44px] pl-10 pr-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent focus:ring-2 focus:ring-border-accent transition-all"
          />
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
              className={`min-h-[44px] px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-surface border border-border-default text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-bg-elevated text-text-primary'
                      : 'bg-bg-elevated text-text-muted'
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
              className="text-text-muted animate-spin mx-auto mb-4"
            />
            <p className="text-text-secondary text-sm">
              Loading conversations...
            </p>
          </div>
        </Card>
      ) : error ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <WarningCircle
              size={48}
              weight="light"
              className="mx-auto text-text-secondary mb-4"
            />
            <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
              Couldn&apos;t load your conversations
            </h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-5">
              {error} Your messages are safe — this only affects this screen.
            </p>
            <Button
              variant="secondary"
              onClick={() => fetchConversations(true)}
              className="mx-auto"
            >
              <ArrowClockwise size={16} weight="light" />
              Try again
            </Button>
          </div>
        </Card>
      ) : filteredConversations.length === 0 ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-bg-surface mx-auto mb-4 flex items-center justify-center">
              <EnvelopeSimple
                size={32}
                weight="light"
                className="text-text-muted"
              />
            </div>
            <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
              {searchQuery
                ? 'No conversations found'
                : activeTab === 'unread'
                  ? 'No unread messages'
                  : 'No conversations yet'}
            </h3>
            <p className="text-text-secondary text-sm max-w-sm mx-auto mb-5">
              {searchQuery
                ? 'No conversation matches that search. Try a customer number or deal name.'
                : activeTab === 'unread'
                  ? "You've replied to everything. New messages show up here."
                  : 'Conversations start when a customer claims one of your deals. Publish a deal to get the first one.'}
            </p>
            {searchQuery ? (
              <Button
                variant="secondary"
                onClick={() => setSearchQuery('')}
                className="mx-auto"
              >
                Clear search
              </Button>
            ) : activeTab === 'unread' ? (
              <Button
                variant="secondary"
                onClick={() => setActiveTab('all')}
                className="mx-auto"
              >
                View all conversations
              </Button>
            ) : (
              <Link
                href="/business/dashboard/deals"
                className="inline-flex items-center justify-center min-h-[44px] px-4 py-2.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
              >
                Manage your deals
              </Link>
            )}
          </div>
        </Card>
      ) : (
        <Card
          variant="glass"
          padding="none"
          className="divide-y divide-border-default"
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
    unread_count,
    consumer_id,
    claim_id,
  } = conversation
  const hasUnread = unread_count > 0

  return (
    <Link
      href={`/business/dashboard/leads/${claim_id}`}
      className="block hover:bg-bg-surface transition-colors"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center">
            <User size={24} weight="fill" className="text-text-secondary" />
          </div>
          {hasUnread && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center">
              {unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`font-medium truncate ${hasUnread ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {getCustomerDisplay(consumer_id)}
            </span>
            <span className="text-xs text-text-muted flex-shrink-0">
              {last_message_at ? formatMessageTime(last_message_at) : ''}
            </span>
          </div>

          <div className="flex items-center gap-2 mb-1.5">
            <Tag
              size={14}
              weight="fill"
              className="text-text-muted flex-shrink-0"
            />
            <span className="text-sm text-text-muted truncate">
              {deal_title}
            </span>
          </div>

          <div className="flex items-start gap-2">
            <ChatCircle
              size={14}
              weight={hasUnread ? 'fill' : 'regular'}
              className={`flex-shrink-0 mt-0.5 ${hasUnread ? 'text-accent' : 'text-text-muted'}`}
            />
            <p
              className={`text-sm truncate ${hasUnread ? 'text-text-primary font-medium' : 'text-text-muted'}`}
            >
              {truncateMessage(last_message ?? '')}
            </p>
          </div>
        </div>
      </div>
    </Link>
  )
}
