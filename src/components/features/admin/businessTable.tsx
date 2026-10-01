'use client'

import { PencilSimple, Star, Storefront } from '@phosphor-icons/react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { BusinessTier } from '@/types/business'

/**
 * The columns this table can source from the live database, and nothing else.
 *
 * It used to take the full `Business` type, which forced the page to invent the
 * fields master_business_info does not have — `tier: 'unclaimed'` and
 * `status: 'active'` as literals for all 419 rows, plus empty phone/email/zip and
 * `latitude: 0`. Tier is real now (business_profiles.tier). Status, Claimed and
 * Deals are gone: no table stores a business status, and the Deals count came from
 * a six-row fixture keyed 'biz-1'..'biz-6', so it read 0 for every real business —
 * including the one with 53 offers.
 */
export interface AdminBusinessRow {
  id: string
  name: string
  city: string
  tier: BusinessTier
  rating: number
  reviewCount: number
  /** E.164, as stored. The contact editor is the one place these three are written from. */
  phone: string | null
  website: string | null
  address: string | null
}

interface BusinessTableProps {
  businesses: AdminBusinessRow[]
  /** Opens the contact-details editor for a row. */
  onEdit: (business: AdminBusinessRow) => void
}

function getTierBadge(tier: BusinessTier) {
  switch (tier) {
    case 'paid':
      return <Badge variant="brand">Paid</Badge>
    case 'free':
      return <Badge variant="info">Free</Badge>
    default:
      return <Badge variant="default">Unclaimed</Badge>
  }
}

function RatingCell({ business }: { business: AdminBusinessRow }) {
  return (
    <div className="flex items-center gap-1.5">
      <Star size={14} weight="fill" className="text-accent-graphic" />
      <span className="text-sm text-text-primary">
        {business.rating.toFixed(1)}
      </span>
      <span className="text-xs text-text-muted">({business.reviewCount})</span>
    </div>
  )
}

function EditButton({
  business,
  onEdit,
}: {
  business: AdminBusinessRow
  onEdit: (business: AdminBusinessRow) => void
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => onEdit(business)}
      className="gap-1.5"
      aria-label={`Edit contact details for ${business.name}`}
    >
      <PencilSimple size={16} />
      Edit contact
    </Button>
  )
}

export function BusinessTable({ businesses, onEdit }: BusinessTableProps) {
  if (businesses.length === 0) {
    return (
      <Card variant="glass" padding="lg" className="text-center py-12">
        <div className="w-16 h-16 mx-auto rounded-full bg-bg-surface flex items-center justify-center mb-4">
          <Storefront
            size={32}
            weight="light"
            className="text-text-secondary"
          />
        </div>
        <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
          No businesses found
        </h3>
        <p className="text-text-secondary">
          Try adjusting your search or filter criteria
        </p>
      </Card>
    )
  }

  return (
    <Card variant="glass" padding="none" className="overflow-hidden">
      {/* The old Actions column was all dead items ("View Details" was an empty onClick,
          Change Tier / Suspend only toasted "aren't available yet"). The one action now is
          real: correcting contact details, under migration 20260924020002. */}

      {/* Desktop Table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Business
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Location
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Tier
              </th>
              <th className="text-left text-sm font-medium text-text-secondary px-6 py-4">
                Rating
              </th>
              <th className="text-right text-sm font-medium text-text-secondary px-6 py-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {businesses.map((business) => (
              <tr
                key={business.id}
                className="hover:bg-bg-elevated transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center">
                      <Storefront
                        size={16}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {business.name}
                    </span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="text-sm text-text-secondary">
                    {business.city}
                  </span>
                </td>
                <td className="px-6 py-4">{getTierBadge(business.tier)}</td>
                <td className="px-6 py-4">
                  <RatingCell business={business} />
                </td>
                <td className="px-6 py-4 text-right">
                  <EditButton business={business} onEdit={onEdit} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List */}
      <div className="lg:hidden divide-y divide-border-default">
        {businesses.map((business) => (
          <div key={business.id} className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-bg-surface flex items-center justify-center">
                <Storefront
                  size={20}
                  weight="fill"
                  className="text-text-secondary"
                />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-text-primary">{business.name}</p>
                <p className="text-sm text-text-secondary">{business.city}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {getTierBadge(business.tier)}
              <RatingCell business={business} />
              <span className="ml-auto">
                <EditButton business={business} onEdit={onEdit} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
