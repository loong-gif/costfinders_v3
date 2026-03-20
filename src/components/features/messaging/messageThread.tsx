'use client'

import { useState, useRef, useEffect } from 'react'
import { PaperPlaneRight, ChatCircle } from '@phosphor-icons/react'
import type { Message } from '@/types/message'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getMessagesForClaim, sendMessage } from '@/lib/mock-data'

interface MessageThreadProps {
  claimId: string
  currentUserId: string
  currentUserType: 'business' | 'consumer'
}

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
  currentUserId,
  currentUserType,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>(() =>
    getMessagesForClaim(claimId)
  )
  const [newMessage, setNewMessage] = useState('')
  const [isSending, setIsSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to latest message
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = () => {
    if (!newMessage.trim() || isSending) return

    setIsSending(true)

    // Simulate send delay
    setTimeout(() => {
      const sent = sendMessage(claimId, newMessage.trim(), currentUserType, currentUserId)
      setMessages((prev) => [...prev, sent])
      setNewMessage('')
      setIsSending(false)
    }, 200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Card variant="glass" padding="none" className="flex flex-col h-[400px]">
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-800">
        <h3 className="text-sm font-medium text-stone-400 flex items-center gap-2">
          <ChatCircle size={18} weight="fill" className="text-stone-500" />
          Messages
        </h3>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-8">
            <div className="w-12 h-12 rounded-full bg-stone-900 flex items-center justify-center mb-3">
              <ChatCircle size={24} weight="light" className="text-stone-500" />
            </div>
            <p className="text-stone-400 text-sm">Start the conversation</p>
            <p className="text-stone-500 text-xs mt-1">
              Send a message to begin chatting
            </p>
          </div>
        ) : (
          <>
            {messages.map((message) => {
              const isOwnMessage = message.senderType === currentUserType
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] ${
                      isOwnMessage
                        ? 'bg-amber-400 text-white rounded-2xl rounded-br-md'
                        : 'bg-stone-800 text-stone-100 rounded-2xl rounded-bl-md'
                    } px-4 py-2.5`}
                  >
                    <p className="text-sm whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage ? 'text-white/70' : 'text-stone-500'
                      }`}
                    >
                      {formatMessageTime(message.createdAt)}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-stone-800">
        <div className="flex items-end gap-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            rows={1}
            className="flex-1 px-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 placeholder:text-stone-500 resize-none focus:outline-none focus:border-amber-400/50 focus:ring-2 focus:ring-amber-400/20 transition-all text-sm min-h-[42px] max-h-[120px]"
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
