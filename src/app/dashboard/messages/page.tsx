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
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { ConversationWithPreview } from '@/types/messaging'

type FilterTab = 'all' | 'unread'

/**
 * Polling interval for refreshing the conversation list (ms).
 *
 * The open thread is live — public.messages is in the supabase_realtime publication as of
 * migration 20260910040003, and MessageThread subscribes to it. This poll only keeps the LIST
 * previews and unread counts fresh, and each tick costs 1 + 3N queries (messaging.ts runs a
 * last-message, unread-count, claim and offer query per conversation), so it runs a minute
 * apart and not at all on a backgrounded tab.
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

function truncateMessage(message: string, maxLength = 60): string {
  if (message.length <= maxLength) return message
  return `${message.slice(0, maxLength)}...`
}

export default function ConsumerMessagesPage() {
  const { state } = useAuth()
  const userId = state.user?.id

  const [conversations, setConversations] = useState<ConversationWithPreview[]>(
    [],
  )
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  // claim_id -> clinic name. The customer has claimed, so the name is theirs to see.
  const [clinicNames, setClinicNames] = useState<Record<string, string>>({})

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
    fetchConversations()

    pollRef.current = setInterval(() => {
      if (document.visibilityState === 'visible') fetchConversations()
    }, POLL_INTERVAL)
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [fetchConversations])

  // Clinic names, looked up once per set of claims rather than on every poll. getConversationsAction
  // leaves other_party_name null, and that file belongs to the owner-side messaging work, so the
  // join happens here: claims (own rows under RLS) -> master_business_info (public read).
  // ponytail: one query for all threads; move it into getConversationsAction if another
  // surface needs the name.
  const claimIds = conversations.map((c) => c.claim_id).join(',')
  useEffect(() => {
    if (!claimIds) return
    let cancelled = false
    createSupabaseBrowserClient()
      .from('claims')
      .select('id, master_business_info(name)')
      .in('id', claimIds.split(','))
      .then(({ data, error }) => {
        if (error) console.warn('messages: clinic names failed', error.message)
        if (cancelled || !data) return
        // Untyped client, so supabase-js guesses the embed is an array. It is many-to-one
        // (fk_claims_business), and PostgREST returns an object for that.
        const rows = data as unknown as {
          id: string
          master_business_info: { name: string | null } | null
        }[]
        const names: Record<string, string> = {}
        for (const row of rows) {
          if (row.master_business_info?.name) {
            names[row.id] = row.master_business_info.name
          }
        }
        setClinicNames(names)
      })
    return () => {
      cancelled = true
    }
  }, [claimIds])

  // ---------- Filtering ----------

  let filtered = conversations
  if (activeTab === 'unread') {
    filtered = conversations.filter((c) => c.unread_count > 0)
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase()
    filtered = filtered.filter(
      (c) =>
        c.deal_title?.toLowerCase().includes(q) ||
        clinicNames[c.claim_id]?.toLowerCase().includes(q),
    )
  }

  const unreadCount = conversations.filter((c) => c.unread_count > 0).length

  const tabs: { id: FilterTab; label: string; count?: number }[] = [
    { id: 'all', label: 'All', count: conversations.length },
    { id: 'unread', label: 'Unread', count: unreadCount },
  ]

  // ---------- Selected thread view ----------

  if (selectedConversationId && userId) {
    const selected = conversations.find((c) => c.id === selectedConversationId)
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedConversationId(null)}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} weight="bold" />
          Back to messages
        </button>

        <MessageThread
          conversationId={selectedConversationId}
          currentUserId={userId}
          currentUserType="consumer"
          title={selected ? clinicNames[selected.claim_id] : undefined}
        />
      </div>
    )
  }

  // ---------- Loading state ----------

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-20 rounded-xl bg-bg-surface animate-pulse"
          />
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
            className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
          />
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-bg-surface border border-border-default rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-border-accent focus:ring-2 focus:ring-border-accent transition-all"
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
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-surface border border-border-default text-text-secondary hover:bg-bg-elevated'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs ${
                    activeTab === tab.id
                      ? 'bg-white/20 text-white'
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

      {/* Conversations List */}
      {filtered.length === 0 ? (
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
                  : 'No messages yet'}
            </h3>
            <p className="text-text-secondary text-sm mb-6">
              {searchQuery
                ? 'Try adjusting your search terms'
                : activeTab === 'unread'
                  ? "You're all caught up!"
                  : "Most businesses listed here don't have a CostFinders account yet. Claim a deal from one that does and your conversation opens here."}
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
          className="divide-y divide-border-default"
        >
          {filtered.map((conversation) => (
            <ConversationItem
              key={conversation.id}
              conversation={conversation}
              clinicName={clinicNames[conversation.claim_id]}
              onSelect={() => setSelectedConversationId(conversation.id)}
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
  clinicName,
  onSelect,
}: {
  conversation: ConversationWithPreview
  clinicName?: string
  onSelect: () => void
}) {
  const hasUnread = conversation.unread_count > 0

  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full text-left hover:bg-bg-surface transition-colors"
    >
      <div className="p-4 flex items-center gap-4">
        {/* Avatar / Icon */}
        <div className="relative flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center">
            <ChatCircle
              size={24}
              weight="fill"
              className="text-text-secondary"
            />
          </div>
          {hasUnread && (
            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-white text-xs font-semibold flex items-center justify-center">
              {conversation.unread_count}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span
              className={`font-medium truncate ${hasUnread ? 'text-text-primary' : 'text-text-secondary'}`}
            >
              {clinicName ?? conversation.other_party_name ?? 'Your clinic'}
            </span>
            {conversation.last_message_at && (
              <span className="text-xs text-text-muted flex-shrink-0">
                {formatMessageTime(conversation.last_message_at)}
              </span>
            )}
          </div>

          {conversation.deal_title && (
            <div className="flex items-center gap-2 mb-1.5">
              <Tag
                size={14}
                weight="fill"
                className="text-text-muted flex-shrink-0"
              />
              <span className="text-sm text-text-muted truncate">
                {conversation.deal_title}
              </span>
            </div>
          )}

          {conversation.last_message && (
            <div className="flex items-start gap-2">
              <ChatCircle
                size={14}
                weight={hasUnread ? 'fill' : 'regular'}
                className={`flex-shrink-0 mt-0.5 ${hasUnread ? 'text-accent' : 'text-text-muted'}`}
              />
              <p
                className={`text-sm truncate ${hasUnread ? 'text-text-primary font-medium' : 'text-text-muted'}`}
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
