'use client'

import { ChatCircle, PaperPlaneRight, SpinnerGap } from '@phosphor-icons/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getMessagesAction,
  sendMessageAction,
  markMessagesReadAction,
} from '@/lib/actions/messaging'
import type { MessageRow } from '@/types/messaging'

interface MessageThreadProps {
  claimId: string
  conversationId?: string
  currentUserId: string
  currentUserType: 'business' | 'consumer'
}

const POLL_INTERVAL = 5_000 // 5 seconds

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })

  if (diffDays === 0) {
    return timeStr
  }
  if (diffDays === 1) {
    return `Yesterday ${timeStr}`
  }
  if (diffDays < 7) {
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' })
    return `${dayName} ${timeStr}`
  }

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
  return `${dateStr} ${timeStr}`
}

export function MessageThread({
  claimId,
  conversationId,
  currentUserId,
  currentUserType,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const fetchMessages = useCallback(
    async (showLoading = false) => {
      if (!conversationId) return
      if (showLoading) setIsLoading(true)
      try {
        const result = await getMessagesAction(conversationId)
        if (result.success && result.messages) {
          setMessages(result.messages)
        }
        // Mark messages as read on each fetch
        await markMessagesReadAction(conversationId)
      } catch {
        // Silently fail on polling errors
      } finally {
        if (showLoading) setIsLoading(false)
      }
    },
    [conversationId],
  )

  // Initial fetch + polling
  useEffect(() => {
    if (!conversationId) {
      setIsLoading(false)
      return
    }

    fetchMessages(true)

    pollRef.current = setInterval(() => {
      fetchMessages(false)
    }, POLL_INTERVAL)

    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [conversationId, fetchMessages])

  const handleSend = async () => {
    if (!newMessage.trim() || isSending || !conversationId) return

    setIsSending(true)
    const content = newMessage.trim()

    // Optimistic update: append message with temp ID
    const optimisticMessage: MessageRow = {
      id: `temp-${Date.now()}`,
      conversation_id: conversationId,
      sender_id: currentUserId,
      sender_type: currentUserType,
      content,
      read_at: null,
      created_at: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')

    try {
      const result = await sendMessageAction(conversationId, content)
      if (result.success && result.message) {
        // Replace the optimistic message with the real one
        setMessages((prev) =>
          prev.map((m) => (m.id === optimisticMessage.id ? result.message! : m)),
        )
      }
    } catch {
      // Remove optimistic message on failure
      setMessages((prev) =>
        prev.filter((m) => m.id !== optimisticMessage.id),
      )
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // No conversationId yet — show a placeholder
  if (!conversationId) {
    return (
      <Card variant="glass" padding="none" className="flex flex-col h-[400px]">
        <div className="px-4 py-3 border-b border-[#d4c4b0]">
          <h3 className="text-sm font-medium text-[#78350f] flex items-center gap-2">
            <ChatCircle size={18} weight="fill" className="text-[#92400e]" />
            Messages
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#f2ebe2] flex items-center justify-center mb-3 mx-auto">
              <ChatCircle size={24} weight="light" className="text-[#92400e]" />
            </div>
            <p className="text-[#78350f] text-sm">
              Messaging will be available once the conversation is initialized
            </p>
          </div>
        </div>
      </Card>
    )
  }

  return (
    <Card variant="glass" padding="none" className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#d4c4b0]">
        <h3 className="text-sm font-medium text-[#78350f] flex items-center gap-2">
          <ChatCircle size={18} weight="fill" className="text-[#92400e]" />
          Messages
        </h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <SpinnerGap
              size={24}
              weight="light"
              className="text-[#92400e] animate-spin mb-3"
            />
            <p className="text-[#78350f] text-sm">Loading messages...</p>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-[#f2ebe2] flex items-center justify-center mb-3">
              <ChatCircle size={24} weight="light" className="text-[#92400e]" />
            </div>
            <p className="text-[#78350f] text-sm">Start the conversation</p>
            <p className="text-[#92400e] text-xs mt-1">
              Send a message to begin chatting
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.sender_type === currentUserType
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      isOwnMessage
                        ? 'bg-amber-800 text-white rounded-2xl rounded-br-md'
                        : 'bg-[#faf5ee] text-[#451a03] rounded-2xl rounded-bl-md'
                    } px-4 py-2.5`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <div
                      className={`flex items-center gap-1.5 mt-1 ${
                        isOwnMessage ? 'text-white/70' : 'text-[#92400e]'
                      }`}
                    >
                      <span className="text-xs">
                        {formatMessageTime(message.created_at)}
                      </span>
                      {isOwnMessage && message.read_at && (
                        <span className="text-xs">read</span>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-[#d4c4b0]">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] placeholder:text-[#92400e] resize-none focus:outline-none focus:border-amber-800/40 focus:ring-2 focus:ring-amber-800/15 transition-all text-sm min-h-[42px] max-h-[120px]"
            style={{
              height: 'auto',
              overflow: newMessage.split('\n').length > 3 ? 'auto' : 'hidden',
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={handleSend}
            disabled={!newMessage.trim() || isSending}
            className="h-[42px] px-4"
          >
            <PaperPlaneRight size={18} weight="fill" />
          </Button>
        </div>
      </div>
    </Card>
  )
}
