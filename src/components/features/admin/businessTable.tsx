'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import {
  DotsThreeVertical,
  Eye,
  Prohibit,
  CheckCircle,
  Storefront,
  Star,
  ArrowUp,
  ArrowDown,
  CurrencyDollar,
} from '@phosphor-icons/react'
import type { Business, BusinessStatus, BusinessTier } from '@/types/business'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { getDealsForBusiness } from '@/lib/mock-data/deals'

interface BusinessTableProps {
  businesses: Business[]
  onStatusChange: (businessId: string, status: BusinessStatus) => void
  onTierChange: (businessId: string, tier: BusinessTier) => void
}

function getTierBadge(tier: BusinessTier) {
  switch (tier) {
    case 'paid':
      return <Badge variant="brand">Paid</Badge>
    case 'free':
      return <Badge variant="info">Free</Badge>
    case 'unclaimed':
    default:
      return <Badge variant="default">Unclaimed</Badge>
  }
}

function getStatusBadge(status: BusinessStatus) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>
    case 'pending':
      return <Badge variant="warning">Pending</Badge>
    case 'suspended':
      return <Badge variant="error">Suspended</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function ActionsDropdown({
  business,
  onStatusChange,
  onTierChange,
}: {
  business: Business
  onStatusChange: (businessId: string, status: BusinessStatus) => void
  onTierChange: (businessId: string, tier: BusinessTier) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [showTierMenu, setShowTierMenu] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setShowTierMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const tierOptions: { value: BusinessTier; label: string }[] = [
    { value: 'unclaimed', label: 'Unclaimed' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
  ]

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

          <Link
            href={`/admin/dashboard/monetization/business/${business.id}`}
            className="w-full flex items-center gap-3 px-4 py-3 text-sm text-[#451a03] hover:bg-[#faf5ee] transition-colors text-left"
            onClick={() => setIsOpen(false)}
          >
            <CurrencyDollar size={18} className="text-[#78350f]" />
            Manage Billing
          </Link>

          {/* Tier submenu */}
          <div className="relative">
            <button
              type="button"
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-[#451a03] hover:bg-[#faf5ee] transition-colors text-left"
              onClick={() => setShowTierMenu(!showTierMenu)}
            >
              <span className="flex items-center gap-3">
                {business.tier === 'paid' ? (
                  <ArrowDown size={18} className="text-[#78350f]" />
                ) : (
                  <ArrowUp size={18} className="text-[#78350f]" />
                )}
                Change Tier
              </span>
            </button>
            {showTierMenu && (
              <div className="border-t border-[#d4c4b0] bg-[#faf5ee]">
                {tierOptions
                  .filter((t) => t.value !== business.tier)
                  .map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className="w-full flex items-center gap-3 px-6 py-2.5 text-sm text-[#78350f] hover:bg-[#faf5ee] transition-colors text-left"
                      onClick={() => {
                        onTierChange(business.id, option.value)
                        setIsOpen(false)
                        setShowTierMenu(false)
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
              </div>
            )}
          </div>

          {business.status === 'active' ? (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-[#faf5ee] transition-colors text-left border-t border-[#d4c4b0]"
              onClick={() => {
                onStatusChange(business.id, 'suspended')
                setIsOpen(false)
              }}
            >
              <Prohibit size={18} />
              Suspend Business
            </button>
          ) : (
            <button
              type="button"
              className="w-full flex items-center gap-3 px-4 py-3 text-sm text-emerald-600 hover:bg-[#faf5ee] transition-colors text-left border-t border-[#d4c4b0]"
              onClick={() => {
                onStatusChange(business.id, 'active')
                setIsOpen(false)
              }}
            >
              <CheckCircle size={18} />
              Activate Business
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function BusinessTable({
  businesses,
  onStatusChange,
  onTierChange,
}: BusinessTableProps) {
  if (businesses.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-amber-800/8 flex items-center justify-center mb-4">
          <Storefront size={32} weight="light" className="text-amber-800" />
        </div>
        <h3 className="text-lg font-semibold text-[#451a03] mb-2">
          No businesses found
        </h3>
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
                Business
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Location
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Tier
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Status
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Deals
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Rating
              </th>
              <th className="text-left text-sm font-medium text-[#78350f] px-6 py-4">
                Claimed
              </th>
              <th className="text-right text-sm font-medium text-[#78350f] px-6 py-4">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#d4c4b0]">
            {businesses.map((business) => {
              const dealsCount = getDealsForBusiness(business.id).length
              return (
                <tr
                  key={business.id}
                  className="hover:bg-[#faf5ee] transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-800/8 flex items-center justify-center">
                        <Storefront
                          size={16}
                          weight="fill"
                          className="text-amber-800"
                        />
                      </div>
                      <span className="text-sm font-medium text-[#451a03]">
                        {business.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#78350f]">{business.city}</span>
                  </td>
                  <td className="px-6 py-4">{getTierBadge(business.tier)}</td>
                  <td className="px-6 py-4">{getStatusBadge(business.status)}</td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-[#451a03]">{dealsCount}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1.5">
                      <Star size={14} weight="fill" className="text-amber-800" />
                      <span className="text-sm text-[#451a03]">
                        {business.rating.toFixed(1)}
                      </span>
                      <span className="text-xs text-[#92400e]">
                        ({business.reviewCount})
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {business.claimedAt ? (
                      <div>
                        <span className="text-sm text-emerald-600">Yes</span>
                        <p className="text-xs text-[#92400e]">
                          {formatDate(business.claimedAt)}
                        </p>
                      </div>
                    ) : (
                      <span className="text-sm text-[#92400e]">No</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <ActionsDropdown
                      business={business}
                      onStatusChange={onStatusChange}
                      onTierChange={onTierChange}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden divide-y divide-[#d4c4b0]">
        {businesses.map((business) => {
          const dealsCount = getDealsForBusiness(business.id).length
          return (
            <div key={business.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-amber-800/8 flex items-center justify-center">
                    <Storefront size={20} weight="fill" className="text-amber-800" />
                  </div>
                  <div>
                    <p className="font-medium text-[#451a03]">{business.name}</p>
                    <p className="text-sm text-[#78350f]">{business.city}</p>
                  </div>
                </div>
                <ActionsDropdown
                  business={business}
                  onStatusChange={onStatusChange}
                  onTierChange={onTierChange}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {getTierBadge(business.tier)}
                {getStatusBadge(business.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[#92400e]">Deals: </span>
                  <span className="text-[#451a03]">{dealsCount}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Star size={14} weight="fill" className="text-amber-800" />
                  <span className="text-[#451a03]">
                    {business.rating.toFixed(1)}
                  </span>
                  <span className="text-xs text-[#92400e]">
                    ({business.reviewCount})
                  </span>
                </div>
              </div>

              <div className="text-sm">
                <span className="text-[#92400e]">Claimed: </span>
                {business.claimedAt ? (
                  <span className="text-green-400">
                    Yes ({formatDate(business.claimedAt)})
                  </span>
                ) : (
                  <span className="text-[#92400e]">No</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
