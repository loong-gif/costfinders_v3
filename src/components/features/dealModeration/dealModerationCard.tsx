'use client'

import {
  CalendarBlank,
  Eye,
  EyeSlash,
  PencilSimple,
  Storefront,
  Tag,
} from '@phosphor-icons/react'
import { type FormEvent, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import {
  dealPricing,
  formatPercentOff,
  NEUROTOXIN_UNIT_PRICE_RANGE,
  type PriceDefect,
} from '@/lib/data/adapters'
import { describeInterpretation, TIER_LABELS } from '@/lib/data/interpretation'
import type { AnonymousDeal } from '@/types/deal'

/**
 * A deal as the admin queue sees it: the consumer card's fields plus what only the admin needs.
 * Built in app/admin/dashboard/deals/page.tsx.
 */
export interface AdminDeal extends AnonymousDeal {
  businessId: string
  /** Owner-submitted and never published. See the page for how that is inferred. */
  awaitingFirstReview: boolean
  /** priceDefects() of the offer: what makes a `check` deal unlabelable, in the gate's terms. */
  defects: PriceDefect[]
  /** The raw values behind the edit form, not the adapter's display values. */
  editable: {
    title: string
    discountPrice: number | null
    regularPrice: number | null
    priceModel: string
    /** Only set when the offer has exactly one line item. */
    deliveredUnits: number | null
    itemCount: number
  }
}

/** What the edit form submits. Mirrors DealEditInput in admin-deal-moderation.ts. */
export interface DealEditValues {
  title: string
  discountPrice: number | null
  regularPrice: number | null
  priceModel: string
  deliveredUnits: number | null
}

const TOXIN_RANGE = `$${NEUROTOXIN_UNIT_PRICE_RANGE.min}–$${NEUROTOXIN_UNIT_PRICE_RANGE.max}`

/** What each priceDefects() code means for the editor. Shoppers read describeInterpretation's. */
const DEFECT_LABELS: Record<PriceDefect, string> = {
  'rate-unit-unknown':
    "It's priced per unit, but nothing names the unit. Check the price type.",
  'misread-unit-rate': `A neurotoxin priced per unit outside ${TOXIN_RANGE}, so it's probably not a per-unit price. Check the price and price type.`,
  'price-not-in-text':
    "The deal price isn't in the clinic's wording. Check it against the offer text.",
  'bare-neurotoxin-price': `A neurotoxin total inside the ${TOXIN_RANGE} per-unit range, so it's probably a per-unit price. Check the price type.`,
}

const PRICE_MODEL_OPTIONS = [
  { value: 'total', label: 'Total price' },
  { value: 'per_unit', label: 'Price per unit' },
  { value: 'from', label: 'Starting price ("from $X")' },
]

/**
 * Review is now one decision — on the site, or not — because that is the only publication
 * state the database still carries.
 *
 * This card used to show a four-value verdict (Approve / Request Changes / Reject) on top of
 * the listing control. All three wrote `moderation_status` / `moderation_notes`, which the
 * pipeline dropped on 2026-09-15 (`drop_promo_offer_moderation_columns`) along with the
 * clause in the RLS SELECT policy, so all three would now fail with 42703 — and "Request
 * Changes" had nowhere to put the reviewer's note even if it worked. `is_active` is the
 * surviving switch and setDealListingAction already writes it, notifies the owner and logs the
 * admin action, so the verdict block was deleted rather than repointed. Do not reinstate a
 * richer vocabulary here without a column to store it in.
 */
interface DealModerationCardProps {
  deal: AdminDeal
  // Awaited, so the button's loading state covers the real round trip rather than a
  // fabricated delay. Every caller already passes an async handler.
  onSetListing: (dealId: string, isActive: boolean) => Promise<void>
  /** Resolves to an error message to show in the form, or null when saved. */
  onEdit: (dealId: string, values: DealEditValues) => Promise<string | null>
}

function toNumberOrNull(value: string): number | null {
  const trimmed = value.trim()
  return trimmed === '' ? null : Number(trimmed)
}

/**
 * Correct what the pipeline got wrong. The server re-validates every field and says which part
 * saved if only some of it did.
 */
function DealEditForm({
  deal,
  onSave,
  onCancel,
}: {
  deal: AdminDeal
  onSave: (values: DealEditValues) => Promise<string | null>
  onCancel: () => void
}) {
  const initial = deal.editable
  const [title, setTitle] = useState(initial.title)
  const [discountPrice, setDiscountPrice] = useState(
    initial.discountPrice?.toString() ?? '',
  )
  const [regularPrice, setRegularPrice] = useState(
    initial.regularPrice?.toString() ?? '',
  )
  const [priceModel, setPriceModel] = useState(initial.priceModel)
  const [units, setUnits] = useState(initial.deliveredUnits?.toString() ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    const message = await onSave({
      title,
      discountPrice: toNumberOrNull(discountPrice),
      regularPrice: toNumberOrNull(regularPrice),
      priceModel,
      deliveredUnits: initial.itemCount === 1 ? toNumberOrNull(units) : null,
    })
    setSaving(false)
    if (message) setError(message)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        maxLength={200}
        required
        hint="What the deal card shows as its name."
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Deal price ($)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={discountPrice}
          onChange={(e) => setDiscountPrice(e.target.value)}
        />
        <Input
          label="Regular price ($)"
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={regularPrice}
          onChange={(e) => setRegularPrice(e.target.value)}
          hint="Leave empty if the clinic doesn't state one."
        />
      </div>
      <Select
        label="Price type"
        value={priceModel}
        onChange={(e) => setPriceModel(e.target.value)}
      >
        {PRICE_MODEL_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>
      {initial.itemCount === 1 ? (
        <Input
          label="Units included"
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={units}
          onChange={(e) => setUnits(e.target.value)}
          hint='For "$299 for 40 units", enter 40. Leave empty for a single treatment.'
        />
      ) : (
        <p className="text-xs text-text-secondary">
          {initial.itemCount === 0
            ? 'This deal has no line items, so the title is saved as its description and there is no unit count to edit.'
            : `This deal bundles ${initial.itemCount} treatments under one price, so there is no single unit count to edit.`}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg border border-error/20 rounded-lg px-3 py-2"
        >
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </Button>
        <Button type="submit" size="sm" isLoading={saving} disabled={saving}>
          Save changes
        </Button>
      </div>
    </form>
  )
}

const categoryLabels: Record<string, string> = {
  botox: 'Botox',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body',
  skincare: 'Skincare',
  wellness: 'Wellness',
}

const MONTHS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

/**
 * A validity date is a Postgres `date` — no time, no zone. Running it through
 * `new Date('2026-12-31')` parses UTC midnight and prints "Dec 30, 2026" in any zone behind
 * UTC. createdAt is a real timestamptz and still goes through Date.
 */
function formatDate(dateString: string): string {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateString)
  if (dateOnly) {
    const [, y, m, d] = dateOnly
    return `${MONTHS[Number(m) - 1]} ${Number(d)}, ${y}`
  }
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function DealModerationCard({
  deal,
  onSetListing,
  onEdit,
}: DealModerationCardProps) {
  const [confirmTakeDown, setConfirmTakeDown] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [editing, setEditing] = useState(false)
  // The moderator is deciding whether this goes on the site, so they see the price exactly as
  // the site prints it. This printed `${price} ${unit_type}` — "$299 unit" for a 40-unit
  // package — and struck through originalPrice unconditionally, "$0" included.
  const pricing = dealPricing(deal)
  const { tier, reasons } = deal.interpretation

  const handleSetListing = async (isActive: boolean) => {
    setIsProcessing(true)
    await onSetListing(deal.id, isActive)
    setConfirmTakeDown(false)
    setIsProcessing(false)
  }

  return (
    <Card variant="glass" padding="lg" className="space-y-4">
      {/* Header with status */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
            <Tag size={20} weight="fill" className="text-text-secondary" />
          </div>
          <div>
            <h3 className="font-display font-semibold text-text-primary">
              {deal.title}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <Storefront size={14} className="text-text-muted" />
              <span className="text-sm text-text-secondary">
                {deal.businessName || 'Unknown Business'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {deal.awaitingFirstReview && (
            <Badge variant="warning" size="md">
              Awaiting first review
            </Badge>
          )}
          {/* nowrap: at phone width the pill otherwise breaks into two lines inside its rounded border. */}
          <Badge
            variant={deal.isActive ? 'success' : 'default'}
            size="md"
            className="whitespace-nowrap"
          >
            {deal.isActive ? 'On the site' : 'Off the site'}
          </Badge>
        </div>
      </div>

      {/* Deal details */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* A null category means the offer names no single treatment: no badge, as on the site. */}
          {deal.category && (
            <Badge variant="brand" size="sm">
              {categoryLabels[deal.category] ?? deal.category}
            </Badge>
          )}
          {/* discountPercent falls back to 0 when the offer states none; "0% off" is noise. */}
          {deal.discountPercent > 0 && (
            <Badge variant="success" size="sm">
              {formatPercentOff(deal.discountPercent)}
            </Badge>
          )}
        </div>

        <p className="text-sm text-text-secondary line-clamp-2">
          {deal.description}
        </p>

        {/* How the site reads it (interpretOffer). A `check` deal is shown without a comparable
            price and never ranked; fixing the defect in the editor is what lifts it. Every
            reason gets its line: `check` also comes from `discount-unstated`, which has no
            priceDefects() entry, and listing only the defects left those with no reason (9 of 50
            check deals on 2026-09-28). */}
        {tier !== 'as-advertised' && (
          <div className="rounded-lg bg-bg-surface p-2 text-xs text-text-secondary space-y-1">
            <p className="font-medium text-text-primary">
              {TIER_LABELS[tier].label}
            </p>
            <ul className="list-disc pl-4 space-y-0.5">
              {describeInterpretation(deal)
                .lines.slice(0, reasons.length)
                .flatMap((line, i) =>
                  reasons[i] === 'price-defect'
                    ? deal.defects.map((defect) => DEFECT_LABELS[defect])
                    : [line],
                )
                .map((line) => (
                  <li key={line}>{line}</li>
                ))}
            </ul>
          </div>
        )}

        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-text-muted">Price: </span>
            <span className="text-text-primary font-medium">
              {pricing.text}
            </span>
            {pricing.strikeThrough && (
              <span className="text-text-muted ml-2 line-through">
                {pricing.strikeThrough}
              </span>
            )}
            {/* "20% off · Regularly $12" on the site; without it the card said "20% off". */}
            {pricing.note && (
              <span className="text-text-secondary ml-2">{pricing.note}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-4 text-sm text-text-muted">
          <div className="flex items-center gap-1">
            <CalendarBlank size={14} />
            <span>Submitted: {formatDate(deal.createdAt)}</span>
          </div>
          {/* Only 68 of 1000 offers resolve a start date and 104 an end date, so the usual
              outcome is no validity line at all rather than "Invalid Date - Invalid Date". */}
          {(deal.validFrom || deal.validUntil) && (
            <div>
              {deal.validFrom && deal.validUntil
                ? `Valid: ${formatDate(deal.validFrom)} - ${formatDate(deal.validUntil)}`
                : deal.validFrom
                  ? `Valid from: ${formatDate(deal.validFrom)} — Ongoing`
                  : `Valid until: ${formatDate(deal.validUntil)}`}
            </div>
          )}
        </div>

        {deal.termsAndConditions && (
          <div className="text-xs text-text-muted bg-bg-surface rounded-lg p-2">
            <span className="font-medium">Terms: </span>
            {deal.termsAndConditions}
          </div>
        )}
      </div>

      <Modal
        isOpen={editing}
        onClose={() => setEditing(false)}
        title="Edit deal"
        size="lg"
      >
        <DealEditForm
          deal={deal}
          onCancel={() => setEditing(false)}
          onSave={async (values) => {
            const message = await onEdit(deal.id, values)
            if (!message) setEditing(false)
            return message
          }}
        />
      </Modal>

      {/* The listing IS the review decision now — see the note on the props above. */}
      <div className="pt-3 border-t border-border-default space-y-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setEditing(true)}
          disabled={isProcessing}
          className="w-full gap-1.5"
        >
          <PencilSimple size={16} />
          Edit title and price
        </Button>
        {deal.isActive ? (
          confirmTakeDown ? (
            <>
              <p className="text-sm text-text-primary">
                Take this deal off CostFinders? It stops appearing to consumers.
                You can put it back from this card.
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmTakeDown(false)}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  Keep it on the site
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => handleSetListing(false)}
                  disabled={isProcessing}
                  isLoading={isProcessing}
                  className="flex-1"
                >
                  <EyeSlash size={16} weight="bold" />
                  Take it down
                </Button>
              </div>
            </>
          ) : (
            <Button
              variant="danger"
              size="sm"
              onClick={() => setConfirmTakeDown(true)}
              disabled={isProcessing}
              className="w-full"
            >
              <EyeSlash size={16} weight="bold" />
              Take down
            </Button>
          )
        ) : (
          <>
            <p className="text-sm text-text-secondary">
              {deal.awaitingFirstReview
                ? 'A business owner submitted this deal. It has never been on the site.'
                : "This deal is off the site. Consumers can't see it."}
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleSetListing(true)}
              disabled={isProcessing}
              isLoading={isProcessing}
              className="w-full"
            >
              <Eye size={16} weight="bold" />
              {deal.awaitingFirstReview
                ? 'Publish on the site'
                : 'Put it back on the site'}
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}
