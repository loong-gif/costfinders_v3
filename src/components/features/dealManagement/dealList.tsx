'use client'

import { MagnifyingGlass, PencilSimple, Tag } from '@phosphor-icons/react'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { getDealsForBusinessAction } from '@/lib/actions/deal-management'
import {
  getOfferConfirmationsForBusinessAction,
  type OfferConfirmationState,
} from '@/lib/actions/offer-confirmations'
import {
  dealPricing,
  formatPercentOff,
  formatPrice,
  offerToAnonymousDeal,
} from '@/lib/data/adapters'
import type { OfferView } from '@/types/supabase'
import { DealConfirmation } from './dealConfirmation'

type FilterTab = 'all'

interface DealListProps {
  businessId: string
}

export function DealList({ businessId }: DealListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<FilterTab>('all')
  const [allDeals, setAllDeals] = useState<OfferView[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // The owner's latest confirmation or correction per deal, keyed by offer id.
  const [confirmations, setConfirmations] = useState<
    Map<number, OfferConfirmationState>
  >(new Map())
  const [confirmationsError, setConfirmationsError] = useState<string | null>(
    null,
  )

  // Load deals from Supabase
  const loadDeals = useCallback(async () => {
    setIsLoading(true)
    setLoadError(null)
    setConfirmationsError(null)
    const [result, confirmed] = await Promise.all([
      getDealsForBusinessAction(Number(businessId)),
      getOfferConfirmationsForBusinessAction(Number(businessId)),
    ])
    if (result.success && result.deals) {
      setAllDeals(result.deals)
    } else {
      setLoadError(result.error ?? 'Failed to load deals.')
    }
    // The deals still list without these; only the confirmation states are unknown.
    if (confirmed.success) {
      setConfirmations(
        new Map((confirmed.confirmations ?? []).map((c) => [c.offerId, c])),
      )
    } else {
      setConfirmationsError(
        confirmed.error ?? "We couldn't load your confirmations.",
      )
    }
    setIsLoading(false)
  }, [businessId])

  const saveConfirmation = useCallback((state: OfferConfirmationState) => {
    setConfirmations((prev) => new Map(prev).set(state.offerId, state))
  }, [])

  const confirmationFor = (deal: OfferView) => (
    <DealConfirmation
      offerId={deal.id}
      state={confirmations.get(deal.id)}
      onSite={deal.is_active === true}
      onSaved={saveConfirmation}
    />
  )

  useEffect(() => {
    loadDeals()
  }, [loadDeals])

  // Filter deals based on search
  const filteredDeals = useMemo(() => {
    let filtered = allDeals

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (deal) =>
          (deal.service_name ?? '').toLowerCase().includes(query) ||
          (deal.service_category ?? '').toLowerCase().includes(query),
      )
    }

    return filtered
  }, [allDeals, searchQuery])

  // Tab counts
  const tabCounts = useMemo(() => {
    return {
      all: allDeals.length,
    }
  }, [allDeals])

  // No delete: nothing marks which offers an owner created, and deleting any offer cascades
  // away every customer claim and saved copy of it (see 20260924030002).

  // The deal price as the site prints it: "$299 for 40 units", "$10 per unit", "$79". This used
  // to print `unit_type` after both figures — the service's unit vocabulary, not what the price
  // buys — so a 40-unit package read "$299 unit" over a struck "$480 unit". The struck regular
  // price is dealPricing's `strikeThrough`, null unless the regular is above the deal price: a
  // regular at or below it is not a discount, and a neurotoxin rate the adapter rejects has no
  // price to strike against. It prints bare and shares the lead's basis ("$480" under "$299 for
  // 40 units"). Only then is the basis above its label: a row with no deal price strikes the raw
  // regular price with no basis anywhere.
  const pricing = (deal: OfferView) => dealPricing(offerToAnonymousDeal(deal))

  /**
   * The owner-facing publication state, from the one column that still carries it.
   *
   * This used to read `moderation_status` and render Under Review / Rejected / Changes
   * Needed. The pipeline dropped that column on 2026-09-15, so every deal would have hit the
   * default arm and read "Active" whether or not it was on the site.
   *
   * The wording is "Off the site", not "Awaiting review", and that distinction was worth
   * checking in the browser: business 765's list is 19 on / 30 off, and all 30 are offers the
   * ingestion pipeline deactivated because the provider stopped running them. Nobody is going
   * to review those. Nothing in the schema separates "submitted, not yet published" from
   * "delisted" — is_active is one bit — so the honest label is the one that is true in both
   * cases, and it matches what the admin queue calls the same state.
   */
  // nowrap: beside the Confirmation column the pill otherwise broke into a three-line circle.
  const getListingBadge = (isActive: boolean | null) =>
    isActive ? (
      <Badge variant="success" size="sm" className="whitespace-nowrap">
        On the site
      </Badge>
    ) : (
      <Badge variant="warning" size="sm" className="whitespace-nowrap">
        Off the site
      </Badge>
    )

  // The offer's own wording under its title. A confirmation vouches for this text (its md5 is in
  // the snapshot), and titles repeat — business 765 has two rows titled just "Facial", one of them
  // "10% OFF Nail Fungus Treatment" — so the owner must see what they are confirming. Null where
  // the title already is the text (an owner-created deal falls back to it).
  const offerWords = (deal: OfferView) =>
    deal.offer_raw_text && deal.offer_raw_text !== deal.service_name
      ? deal.offer_raw_text
      : null

  // Loading state
  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="flex flex-col items-center gap-4">
          <svg
            aria-hidden="true"
            className="animate-spin h-8 w-8 text-accent"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          <p className="text-text-secondary">Loading deals...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-12">
          <h3 className="text-lg font-medium text-text-primary mb-2">
            Failed to load deals
          </h3>
          <p className="text-text-secondary mb-6">{loadError}</p>
          <Button onClick={loadDeals}>Retry</Button>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Deals
          </h1>
          {/* No "Create Deal" and no "Sponsored": an owner-created deal could never go live, and
              the sponsored count was a fixture that ignored the business id. */}
          <p className="text-text-secondary mt-1">
            The offers listed for your business. You can edit their text and
            prices.
          </p>
          {/* What confirming does, in the terms public_offer_confirmations enforces. */}
          <p className="text-sm text-text-secondary mt-2 max-w-2xl">
            When you confirm a deal is correct, it shows &ldquo;Confirmed by the
            clinic&rdquo; on CostFinders until its price or wording changes. If
            something is wrong, suggest a correction and our team will review
            it.
          </p>
        </div>
      </div>

      {confirmationsError && (
        <p
          role="alert"
          className="text-sm text-warning bg-warning/10 border border-warning/20 rounded-xl px-4 py-3"
        >
          {confirmationsError} You can still confirm or correct a deal.
        </p>
      )}

      {/* Filters and Search */}
      <Card variant="glass" padding="md">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Filter Tabs */}
          <div className="flex gap-2">
            {(['all'] as FilterTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`
                  px-4 py-2 rounded-xl text-sm font-medium transition-all
                  ${
                    activeTab === tab
                      ? 'bg-text-primary text-white'
                      : 'bg-bg-surface text-text-secondary hover:text-text-primary hover:bg-bg-elevated'
                  }
                `}
                type="button"
              >
                All ({tabCounts[tab]})
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 sm:max-w-xs">
            <div className="relative">
              <MagnifyingGlass
                size={20}
                weight="light"
                className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="text"
                placeholder="Search deals..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>
      </Card>

      {/* Deals Table */}
      {filteredDeals.length === 0 ? (
        <Card variant="glass" padding="lg">
          <div className="text-center py-12">
            <Tag
              size={48}
              weight="light"
              className="mx-auto text-text-muted mb-4"
            />
            <h3 className="text-lg font-medium text-text-primary mb-2">
              {searchQuery ? 'No deals found' : 'No deals yet'}
            </h3>
            <p className="text-text-secondary">
              {searchQuery
                ? 'Try adjusting your search query'
                : 'Offers we list for your business appear here.'}
            </p>
          </div>
        </Card>
      ) : (
        <Card variant="glass" padding="none" className="overflow-hidden">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border-default">
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Deal
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Category
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Price
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Off
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Status
                  </th>
                  <th className="text-left px-6 py-4 text-sm font-medium text-text-secondary">
                    Confirmation
                  </th>
                  <th className="text-right px-6 py-4 text-sm font-medium text-text-secondary">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {filteredDeals.map((deal) => (
                  <tr
                    key={deal.id}
                    className="hover:bg-bg-surface transition-colors"
                  >
                    {/* Deal Title */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center flex-shrink-0">
                          <Tag
                            size={20}
                            weight="fill"
                            className="text-text-secondary"
                          />
                        </div>
                        <div className="min-w-0">
                          {/* Resolved from promo_offer_items.item_name, falling back to
                              offer_raw_text — which is what an owner-created deal carries.
                              The template_type subtitle that sat under it is gone with the
                              column. */}
                          <p className="font-medium text-text-primary truncate">
                            {deal.service_name ?? 'Untitled Deal'}
                          </p>
                          {offerWords(deal) && (
                            <p className="text-sm text-text-secondary line-clamp-2 max-w-xs mt-0.5">
                              &ldquo;{offerWords(deal)}&rdquo;
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-6 py-4">
                      {deal.service_category ? (
                        <Badge variant="default" size="sm">
                          {deal.service_category}
                        </Badge>
                      ) : (
                        <span className="text-sm text-text-muted">—</span>
                      )}
                    </td>

                    {/* Price */}
                    <td className="px-6 py-4">
                      <div>
                        {deal.discount_price != null && (
                          <p className="font-display font-semibold tabular-nums text-text-primary">
                            {pricing(deal).text}
                          </p>
                        )}
                        {deal.discount_price != null
                          ? pricing(deal).strikeThrough && (
                              <p className="text-sm text-text-muted line-through">
                                {pricing(deal).strikeThrough}
                              </p>
                            )
                          : deal.regular_price != null && (
                              <p className="text-sm text-text-muted line-through">
                                {formatPrice(deal.regular_price)}
                              </p>
                            )}
                        {deal.discount_price == null &&
                          deal.regular_price == null && (
                            <span className="text-sm text-text-muted">—</span>
                          )}
                      </div>
                    </td>

                    {/* Discount */}
                    <td className="px-6 py-4">
                      {deal.discount_percent != null ? (
                        <Badge variant="brand" size="sm">
                          {formatPercentOff(deal.discount_percent)}
                        </Badge>
                      ) : (
                        <span className="text-sm text-text-muted">—</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4">
                      {getListingBadge(deal.is_active)}
                    </td>

                    <td className="px-6 py-4 min-w-[16rem]">
                      {confirmationFor(deal)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-end gap-2">
                        {/* The label goes on both the <a> and the <button>
                            it wraps: <Link><Button> renders two nested,
                            separately focusable controls, so naming only one
                            leaves the other announcing as "button". */}
                        <Link
                          href={`/business/dashboard/deals/${deal.id}/edit`}
                          aria-label={`Edit ${deal.service_name ?? 'Untitled Deal'}`}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Edit ${deal.service_name ?? 'Untitled Deal'}`}
                          >
                            <PencilSimple
                              size={18}
                              weight="light"
                              aria-hidden="true"
                            />
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-border-default">
            {filteredDeals.map((deal) => (
              <div key={deal.id} className="p-4">
                {/* Header: Title + Category */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center flex-shrink-0">
                      <Tag
                        size={20}
                        weight="fill"
                        className="text-text-secondary"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-text-primary truncate">
                        {deal.service_name ?? 'Untitled Deal'}
                      </p>
                      {offerWords(deal) && (
                        <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">
                          &ldquo;{offerWords(deal)}&rdquo;
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                        {deal.service_category && (
                          <Badge variant="default" size="sm">
                            {deal.service_category}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  {deal.discount_percent != null && (
                    <Badge variant="brand" size="sm" className="flex-shrink-0">
                      {formatPercentOff(deal.discount_percent)}
                    </Badge>
                  )}
                </div>

                {/* Middle: Price */}
                <div className="flex items-center justify-between mb-3 py-3 border-t border-b border-border-default">
                  <div>
                    {deal.discount_price != null && (
                      <p className="font-display font-semibold tabular-nums text-text-primary">
                        {pricing(deal).text}
                      </p>
                    )}
                    {deal.discount_price != null
                      ? pricing(deal).strikeThrough && (
                          <p className="text-sm text-text-muted line-through">
                            {pricing(deal).strikeThrough}
                          </p>
                        )
                      : deal.regular_price != null && (
                          <p className="text-sm text-text-muted line-through">
                            {formatPrice(deal.regular_price)}
                          </p>
                        )}
                  </div>
                </div>

                <div className="mb-3">{confirmationFor(deal)}</div>

                {/* Footer: Actions */}
                <div className="flex items-center justify-end gap-2">
                  <Link
                    href={`/business/dashboard/deals/${deal.id}/edit`}
                    aria-label={`Edit ${deal.service_name ?? 'Untitled Deal'}`}
                  >
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Edit ${deal.service_name ?? 'Untitled Deal'}`}
                    >
                      <PencilSimple
                        size={18}
                        weight="light"
                        aria-hidden="true"
                      />
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}
