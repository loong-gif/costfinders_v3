'use client'

import {
  CheckCircle,
  DotsThreeVertical,
  Prohibit,
  User,
} from '@phosphor-icons/react'
import { useEffect, useRef, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import type { AdminConsumer } from '@/lib/actions/admin-user-actions'

interface ConsumerTableProps {
  consumers: AdminConsumer[]
  /** Asks for the change; the page confirms it before anything is written. */
  onStatusChange: (consumerId: string, status: 'active' | 'suspended') => void
}

function getVerificationBadge(status: string) {
  switch (status) {
    case 'fully_verified':
      return <Badge variant="success">Fully Verified</Badge>
    case 'email_verified':
      return <Badge variant="info">Email Verified</Badge>
    case 'phone_verified':
      return <Badge variant="info">Phone Verified</Badge>
    default:
      return <Badge variant="default">Unverified</Badge>
  }
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>
    case 'suspended':
      return <Badge variant="error">Suspended</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ActionsDropdown({
  consumer,
  onStatusChange,
}: {
  consumer: AdminConsumer
  onStatusChange: (consumerId: string, status: 'active' | 'suspended') => void
}) {
  // Where the open menu sits, in viewport coordinates; null = closed. The menu is `fixed`, not
  // `absolute`: the table's overflow-x-auto wrapper and the card's overflow-hidden clipped an
  // absolute menu, so on a one-row table "Suspend user" was cut off.
  // ponytail: closes on scroll rather than tracking the button.
  const [menuPos, setMenuPos] = useState<{
    top: number
    right: number
  } | null>(null)
  const isOpen = menuPos !== null
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setMenuPos(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const close = () => setMenuPos(null)
    window.addEventListener('scroll', close, { capture: true, passive: true })
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [isOpen])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={(e) => {
          if (isOpen) return setMenuPos(null)
          const rect = e.currentTarget.getBoundingClientRect()
          setMenuPos({
            top: rect.bottom + 4,
            right: document.documentElement.clientWidth - rect.right,
          })
        }}
        aria-expanded={isOpen}
        className="p-2 rounded-lg hover:bg-bg-elevated transition-colors"
        aria-label="Actions"
      >
        <DotsThreeVertical
          size={20}
          weight="bold"
          className="text-text-secondary"
        />
      </button>

      {menuPos && (
        <div
          className="fixed w-48 bg-bg-surface border border-border-default rounded-xl shadow-elevated z-50 overflow-hidden"
          style={menuPos}
        >
          {consumer.status === 'active' ? (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-error hover:bg-bg-elevated transition-colors text-left"
              onClick={() => {
                onStatusChange(consumer.id, 'suspended')
                setMenuPos(null)
              }}
            >
              <Prohibit size={18} />
              Suspend user
            </button>
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-success hover:bg-bg-elevated transition-colors text-left"
              onClick={() => {
                onStatusChange(consumer.id, 'active')
                setMenuPos(null)
              }}
            >
              <CheckCircle size={18} />
              Reinstate user
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ConsumerTable({
  consumers,
  onStatusChange,
}: ConsumerTableProps) {
  if (consumers.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4">
          <User size={32} weight="light" className="text-text-secondary" />
        </div>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
          No users found
        </h3>
        <p className="text-text-secondary">
          Try adjusting your search or filter criteria
        </p>
      </Card>
    )
  }

  return (
    <Card variant="glass" padding="none" className="overflow-hidden">
      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Name
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Email
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Phone
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Verification
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Status
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Location
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Joined
              </th>
              <th className="text-right text-sm font-medium text-text-secondary px-6 py-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {consumers.map((consumer) => (
              <tr
                key={consumer.id}
                className="hover:bg-bg-elevated transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                      <User
                        size={16}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {consumer.first_name || consumer.last_name
                        ? `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim()
                        : 'No name'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-text-primary break-all">
                    {consumer.email ?? 'No email on file'}
                  </span>
                  <span className="block text-xs text-text-muted font-mono">
                    {consumer.id.slice(0, 8)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-text-secondary">
                    {consumer.phone || '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {getVerificationBadge(consumer.verification_status)}
                </td>
                <td className="px-6 py-4">{getStatusBadge(consumer.status)}</td>
                <td className="px-6 py-4">
                  <span className="text-sm text-text-secondary">
                    {consumer.location_city && consumer.location_state
                      ? `${consumer.location_city}, ${consumer.location_state}`
                      : consumer.location_city ||
                        consumer.location_state ||
                        '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-text-secondary">
                    {formatDate(consumer.created_at)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <ActionsDropdown
                    consumer={consumer}
                    onStatusChange={onStatusChange}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden divide-y divide-border-default">
        {consumers.map((consumer) => (
          <div key={consumer.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center">
                  <User
                    size={20}
                    weight="fill"
                    className="text-text-secondary"
                  />
                </div>
                <div>
                  <p className="font-medium text-text-primary">
                    {consumer.first_name || consumer.last_name
                      ? `${consumer.first_name || ''} ${consumer.last_name || ''}`.trim()
                      : 'No name'}
                  </p>
                  <p className="text-sm text-text-secondary break-all">
                    {consumer.email ?? 'No email on file'}
                  </p>
                  <p className="text-xs text-text-muted font-mono">
                    {consumer.id.slice(0, 8)}
                  </p>
                </div>
              </div>
              <ActionsDropdown
                consumer={consumer}
                onStatusChange={onStatusChange}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {getVerificationBadge(consumer.verification_status)}
              {getStatusBadge(consumer.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-text-muted">Location: </span>
                <span className="text-text-primary">
                  {consumer.location_city && consumer.location_state
                    ? `${consumer.location_city}, ${consumer.location_state}`
                    : consumer.location_city || consumer.location_state || '-'}
                </span>
              </div>
              <div>
                <span className="text-text-muted">Joined: </span>
                <span className="text-text-secondary">
                  {formatDate(consumer.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
