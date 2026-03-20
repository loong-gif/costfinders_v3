'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DotsThreeVertical,
  Eye,
  Prohibit,
  CheckCircle,
  User,
} from '@phosphor-icons/react'
import type { Consumer, ConsumerStatus, VerificationStatus } from '@/types/consumer'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getClaimsCountForConsumer } from '@/lib/mock-data/consumers'

interface ConsumerTableProps {
  consumers: Consumer[]
  onStatusChange: (consumerId: string, status: ConsumerStatus) => void
}

function getVerificationBadge(status: VerificationStatus) {
  switch (status) {
    case 'fully_verified':
      return <Badge variant="success">Fully Verified</Badge>
    case 'email_verified':
      return <Badge variant="info">Email Verified</Badge>
    case 'phone_verified':
      return <Badge variant="info">Phone Verified</Badge>
    case 'unverified':
    default:
      return <Badge variant="default">Unverified</Badge>
  }
}

function getStatusBadge(status: ConsumerStatus) {
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
  consumer: Consumer
  onStatusChange: (consumerId: string, status: ConsumerStatus) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg hover:bg-[#faf5ee] transition-colors"
        aria-label="Actions"
      >
        <DotsThreeVertical size={20} weight="bold" className="text-[#78350f]" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl shadow-elevated z-50 overflow-hidden">
          <button
            type="button"
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#451a03] hover:bg-[#faf5ee] transition-colors text-left"
            onClick={() => {
              setIsOpen(false)
              // View details placeholder
            }}
          >
            <Eye size={18} className="text-[#78350f]" />
            View Details
          </button>
          {consumer.status === 'active' ? (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-[#faf5ee] transition-colors text-left"
              onClick={() => {
                onStatusChange(consumer.id, 'suspended')
                setIsOpen(false)
              }}
            >
              <Prohibit size={18} />
              Suspend User
            </button>
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-600 hover:bg-[#faf5ee] transition-colors text-left"
              onClick={() => {
                onStatusChange(consumer.id, 'active')
                setIsOpen(false)
              }}
            >
              <CheckCircle size={18} />
              Activate User
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function ConsumerTable({ consumers, onStatusChange }: ConsumerTableProps) {
  if (consumers.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-4">
          <User size={32} weight="light" className="text-amber-800" />
        </div>
        <h3 className="text-lg font-semibold text-[#451a03] mb-2">No users found</h3>
        <p className="text-[#78350f]">
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
            <tr className="border-b border-[#d4c4b0]">
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Name
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Email
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Phone
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Verification
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Status
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Claims
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Joined
              </th>
              <th className="text-right text-sm font-medium text-[#78350f] px-6 py-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {consumers.map((consumer) => (
              <tr
                key={consumer.id}
                className="hover:bg-[#faf5ee] transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-800/8 flex items-center justify-center">
                      <User size={16} weight="fill" className="text-amber-800" />
                    </div>
                    <span className="text-sm font-medium text-[#451a03]">
                      {consumer.firstName || consumer.lastName
                        ? `${consumer.firstName || ''} ${consumer.lastName || ''}`.trim()
                        : 'No name'}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-[#78350f]">{consumer.email}</span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-[#78350f]">
                    {consumer.phone || '-'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {getVerificationBadge(consumer.verificationStatus)}
                </td>
                <td className="px-6 py-4">{getStatusBadge(consumer.status)}</td>
                <td className="px-6 py-4">
                  <span className="text-sm text-[#451a03]">
                    {getClaimsCountForConsumer(consumer.id)}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-[#78350f]">
                    {formatDate(consumer.createdAt)}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <ActionsDropdown consumer={consumer} onStatusChange={onStatusChange} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden divide-y divide-[#d4c4b0]">
        {consumers.map((consumer) => (
          <div key={consumer.id} className="p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center">
                  <User size={20} weight="fill" className="text-amber-800" />
                </div>
                <div>
                  <p className="font-medium text-[#451a03]">
                    {consumer.firstName || consumer.lastName
                      ? `${consumer.firstName || ''} ${consumer.lastName || ''}`.trim()
                      : 'No name'}
                  </p>
                  <p className="text-sm text-[#78350f]">{consumer.email}</p>
                </div>
              </div>
              <ActionsDropdown consumer={consumer} onStatusChange={onStatusChange} />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {getVerificationBadge(consumer.verificationStatus)}
              {getStatusBadge(consumer.status)}
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-[#92400e]">Claims: </span>
                <span className="text-[#451a03]">
                  {getClaimsCountForConsumer(consumer.id)}
                </span>
              </div>
              <div>
                <span className="text-[#92400e]">Joined: </span>
                <span className="text-[#78350f]">
                  {formatDate(consumer.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
