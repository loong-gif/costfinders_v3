import type {
  AnonymousDeal,
  InterpretationNote,
  InterpretationReason,
  InterpretationTier,
} from '@/types/deal'
import {
  buyGetFree,
  comparablePrice,
  dealPricing,
  formatPrice,
} from './adapters'

export type {
  DealInterpretation,
  InterpretationNote,
  InterpretationReason,
  InterpretationTier,
} from '@/types/deal'
/**
 * How we read a deal, in words a shopper can check against the clinic's own (spec:
 * .planning/DEAL-BROWSE-AND-TRUST.md §1). `interpretOffer()` itself lives in adapters.ts, because
 * offerToAnonymousDeal() calls it and this module imports adapters; it is re-exported here so the
 * whole contract has one import path.
 */
export { interpretOffer } from './adapters'

/**
 * The one place each tier is named. Rows show `label` for worked-out and check only. `check`'s
 * meaning has to hold for every reason that sets it: a price the wording doesn't state, a price
 * it doesn't say what buys, and a discount it doesn't state — which is why it no longer says "we
 * show only what it states".
 */
export const TIER_LABELS: Record<
  InterpretationTier,
  { label: string; meaning: string }
> = {
  'as-advertised': {
    label: 'As advertised',
    meaning: "Every figure here is in the clinic's own words.",
  },
  'worked-out': {
    label: 'Our math',
    meaning: "We worked something out from the clinic's wording. Here's what.",
  },
  check: {
    label: 'Confirm when booking',
    meaning:
      "We couldn't be sure of the price from the clinic's wording. Confirm it when you book.",
  },
}

/**
 * The deal page's "How we read this deal": the tier's meaning, then one line per reason and note,
 * each carrying the deal's own figures ("The clinic advertised $450 for 40 units; we divided that
 * to $11.25 per unit."). Every figure comes from dealPricing() or comparablePrice(), so a line
 * can never state a number the price block beside it does not.
 */
export function describeInterpretation(deal: AnonymousDeal): {
  headline: string
  lines: string[]
} {
  const { tier, reasons, notes } = deal.interpretation
  const pricing = dealPricing(deal)
  const basis = deal.priceBasis
  const total = formatPrice(deal.dealPrice)
  const counted =
    basis.kind === 'quantity'
      ? `${basis.count.toLocaleString('en-US')} ${basis.unit}s`
      : null

  const reasonLine: Record<InterpretationReason, () => string> = {
    'multiplied-out': () =>
      basis.kind === 'quantity'
        ? `The clinic priced it per ${basis.unit}; the ${total} for ${counted} is our multiplication.`
        : `The ${total} total is our multiplication of the clinic's per-unit price.`,
    'per-unit-divided': () =>
      reasons.includes('multiplied-out')
        ? `We show that as ${pricing.unitPrice} so you can compare it.`
        : `The clinic advertised ${total} for ${counted}; we divided that to ${pricing.unitPrice}.`,
    bundle: () =>
      `The ${total} covers more than one treatment, so it isn't a price for ${deal.title} alone.`,
    'toxin-brand-unnamed': () => {
      const unit = comparablePrice(deal)
      return `The clinic doesn't say which brand this is, so we compare its ${unit ? `${formatPrice(unit.amount)} per unit` : 'price'} with every neurotoxin. Brands dose differently (about 2.5 to 3 Dysport units match one Botox unit), so ask which brand you'll get.`
    },
    // Beside `discount-unstated` the lead is not the clinic's wording either, so it isn't quoted.
    'price-defect': () =>
      `${pricing.kind === 'none' ? "We don't show a price" : reasons.includes('discount-unstated') ? "We don't show the price we hold for it" : `We show only what the clinic's wording states (${pricing.text})`}, and we don't rank it against other prices. Ask the clinic to confirm the price when you book.`,
    'discount-derived': () => {
      const counts = buyGetFree(deal.description)
      return counts
        ? `The clinic advertised “buy ${counts.buy}, get ${counts.free} free”; we counted that as ${pricing.lead}.`
        : `We worked out the ${pricing.lead} from the clinic's wording.`
    },
    'discount-unstated': () =>
      `The clinic's wording doesn't state this discount (${pricing.lead}). It comes from our reading of the offer, which may be wrong.`,
  }
  const noteLine: Record<InterpretationNote, () => string> = {
    'from-price': () =>
      `${pricing.text.replace(/^From /, '')} is the clinic's starting price, so what you pay depends on the treatment you choose.`,
    'regular-price-unstated': () =>
      "We hold a regular price for this deal that the clinic's own wording doesn't state, so we don't show a saving.",
    'members-only': () =>
      "This deal is for members of the clinic's membership plan.",
    'new-patients-only': () => "It's for new patients only.",
    'clinic-wide': () =>
      "The discount applies across the clinic's services, so we don't list it under one treatment.",
    'no-treatment': () =>
      "It doesn't name a single treatment, so we don't list it under one.",
    // Not "the clinic states": beside discount-derived or discount-unstated it doesn't.
    'discount-only': () =>
      `There's a discount (${pricing.lead}) but no price, so there's no price to compare.`,
  }

  return {
    headline: TIER_LABELS[tier].meaning,
    lines: [
      ...reasons.map((reason) => reasonLine[reason]()),
      ...notes.map((note) => noteLine[note]()),
    ],
  }
}
