export type TreatmentCategory =
  | 'botox'
  | 'fillers'
  | 'facials'
  | 'laser'
  | 'body'
  | 'skincare'
  | 'wellness'

/**
 * How sure we are of our reading of a deal — `interpretOffer()` (src/lib/data/adapters.ts,
 * re-exported by interpretation.ts) decides it, `TIER_LABELS` in interpretation.ts names it. A
 * label, never a numeric score (owner decision, 2026-09-28).
 */
export type InterpretationTier = 'as-advertised' | 'worked-out' | 'check'

/** Lowers the tier. */
export type InterpretationReason =
  /** Quantity basis: we print a per-unit figure we divided out. */
  | 'per-unit-divided'
  /** Stored total = stated rate × count; the total is our arithmetic. */
  | 'multiplied-out'
  /** item_count > 1: one price across several treatments, titled by one. */
  | 'bundle'
  /** A neurotoxin naming no single brand, compared against pooled brands. */
  | 'toxin-brand-unnamed'
  /** Any priceDefects(offer) — the site's own "cannot label truthfully". Check tier. */
  | 'price-defect'
  /** No price shown; the percent off it leads with is our count of "buy N, get M free". */
  | 'discount-derived'
  /** No price shown; the percent or amount off it leads with is not in the text. Check tier. */
  | 'discount-unstated'

/** Context only; never changes the tier. */
export type InterpretationNote =
  | 'from-price'
  | 'regular-price-unstated'
  | 'members-only'
  | 'new-patients-only'
  | 'clinic-wide'
  | 'no-treatment'
  | 'discount-only'

export interface DealInterpretation {
  tier: InterpretationTier
  reasons: InterpretationReason[]
  notes: InterpretationNote[]
}

/**
 * The number a deal is ranked, filtered and summarised by — see `comparablePrice()` in
 * src/lib/data/adapters.ts, which re-exports this.
 */
export interface ComparablePrice {
  amount: number
  /** True when `amount` is a price per unit — every surface printing it must say so. */
  perUnit: boolean
  /**
   * Neurotoxins only: the one brand the offer names (`neurotoxinBrand()`), absent when none or
   * several. A Dysport unit is about a third of a Botox unit, so a pooled per-unit floor must
   * name its brand, and a Dysport price is never set against the typical price.
   */
  brand?: string
  /** A "from $X" starting price: the floor the clinic advertises, not what you pay. */
  from?: true
}

/**
 * A member price's plan, for the deal page only (`offerMembershipTerms()` in adapters.ts). Never
 * part of a listing payload: listings say "for members" and show no fee (owner decision,
 * 2026-09-28).
 */
export interface MembershipTerms {
  /**
   * Always null before a claim: a plan's name identifies the clinic (owner decision, 2026-09-28).
   * A claimant gets it from claimed_membership_name() via getBusinessRevealAction.
   */
  name: string | null
  price: number | null
  billingPeriod: 'monthly' | 'annual' | 'quarterly' | 'one_time' | null
  minimumCommitmentMonths: number | null
}

/**
 * The fields a row card prints — a plain, serialisable shape, so the homepage's client-side
 * price panel can render the same OfferRow from JSON that every list renders from a deal.
 * Built by `offerToLean()` in src/lib/data/adapters.ts; the price strings come from
 * dealPricing(), so a row and a full card can never disagree about a price.
 */
export interface LeanOffer {
  id: number
  title: string
  /** The offer's own words under a bare product title ("Botox", "Neurotoxin"), else null. */
  subtitle: string | null
  /** Null for an offer that names no single treatment — it gets no badge. */
  treatment: TreatmentCategory | null
  cityLabel: string | null
  lead: string
  basis: string | null
  strikeThrough: string | null
  savingsPercent: number | null
  /** 'price' leads with a money figure; anything else leads with words. */
  leadIsPrice: boolean
  interpretationTier: InterpretationTier
  requiresMembership: boolean
  clinicConfirmed: boolean
  /** comparablePrice() of the deal: null for anything we do not rank, `check` tier included. */
  comparable: ComparablePrice | null
  /**
   * A clinic-wide discount by its wording (the `clinic-wide` note). Its title is whatever one
   * service the pipeline linked it to, so productLine() prints none rather than that service.
   */
  clinicWide?: boolean
}

export type ModerationStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'

/**
 * What a deal's price buys. Decided once, in `offerPriceBasis()` (src/lib/data/adapters.ts).
 *
 * - `rate` — the price is for ONE `unit`: "$4.25 per unit", "$765 per vial". `unit` is null
 *   only when neither the service, the category nor the offer's own words name it.
 * - `quantity` — the price buys `count` of `unit`: "$299 for 40 units".
 * - `total` — a flat price with nothing to divide by: one treatment ("Lip Flip $79"), a bundle
 *   of different treatments, a credit. No per-unit figure exists for these, so none is shown.
 */
export type PriceBasis =
  | { kind: 'rate'; unit: string | null }
  | { kind: 'quantity'; count: number; unit: string }
  | { kind: 'total' }

export interface Deal {
  id: string
  businessId: string
  businessName?: string
  title: string
  description: string
  /**
   * Null when the offer names no single treatment: it resolves no service_category, or it is a
   * clinic-wide discount (see `blanketOfferIds()` in src/lib/data/offers.ts). Such a deal shows
   * no badge and is on no treatment page — it stays on its city and provider listings.
   */
  category: TreatmentCategory | null
  /**
   * The regular price, only where the clinic's own words state it (or an owner typed it into a
   * field) — else 0, and so no strike-through, saving or list price anywhere. See
   * `statedRegularPrice()` in src/lib/data/adapters.ts.
   */
  originalPrice: number
  dealPrice: number
  discountPercent: number
  /**
   * Dollars off, as the offer itself states them — `promo_offer_master.discount_amount`.
   *
   * 144 of 814 visible offers state their discount ONLY this way ("$100 off", no base price).
   * Without this field the adapter dropped that number on the floor and those offers reached
   * every card with nothing to show, which is what made "Contact for pricing" the render for
   * 41% of the inventory. Optional because nothing outside the offer adapter sets it.
   * Read it through `dealPricing()`, never raw — see src/lib/data/adapters.ts.
   */
  discountAmount?: number
  /**
   * `promo_offer_master.is_membership_required`. 17 of the 27 offers that reach 100% off are
   * benefits of a paid plan ($99–$1,925), not giveaways, and the card's title is the treatment
   * rather than the plan — so `dealPricing()` reads this to say "Free with membership" instead
   * of "Free". `termsAndConditions` carries the same fact in prose, which no surface renders.
   */
  requiresMembership?: boolean
  /**
   * `promo_offer_master.price_model === 'from'` — 20 visible offers publish a floor ("Laser Hair
   * Removal as Low as $50"), which `dealPricing()` leads with as "From $50". Deliberately a
   * boolean and not the raw column: the other two values ('total', 'per_unit') are already
   * carried by `priceBasis`, and nothing outside the adapter should compare that string.
   */
  isFromPrice?: boolean
  /**
   * What `dealPrice` is the price OF. Read it through `dealPricing()` (which prints it) or
   * `perUnitPrice()` / `comparablePrice()` (which rank by it), never to build a label by hand.
   *
   * This replaced `unit: string`, which was `clinic_services.unit_type` — the SERVICE's
   * vocabulary ("Botox is sold in units"), not the offer's price basis. Printed after every
   * price, it turned "40 Units Botox $299" into "$299 unit" and "Lip Flip $79" into "$79 unit",
   * while 131 real per-unit rates whose service had no unit_type printed as a bare "$4.25".
   * 201 of 497 priced offers read wrong on 2026-09-17. See `offerPriceBasis()`.
   */
  priceBasis: PriceBasis
  validFrom: string // ISO date
  validUntil: string // ISO date
  termsAndConditions: string
  imageUrl?: string
  isActive: boolean
  isFeatured: boolean
  isSponsored: boolean
  claimCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  // Moderation fields (optional for backward compatibility)
  moderationStatus?: ModerationStatus
  moderationNotes?: string
}

/**
 * Legacy offer archetype. NOTHING in the database produces this any more —
 * `promo_offer_master.template_type` was dropped by the normalization and has no successor.
 * `price_model` (total / per_unit / from) is the nearest surviving column, but it describes
 * pricing shape rather than offer archetype, so it must not be re-pointed here.
 *
 * ponytail: only `src/lib/mock-data/deals.ts` still sets this, which is why the field is
 * optional rather than deleted. Delete both when the mock fixtures go.
 */
export type TemplateType =
  | 'FIXED_PRICE'
  | 'DISCOUNT'
  | 'BUNDLE'
  | 'MEMBERSHIP'
  | 'COMPLIMENTARY'

// What consumers see before verification
export interface AnonymousDeal extends Omit<Deal, 'businessId'> {
  // No rating or review count: either named the clinic (see offerToAnonymousDeal).
  locationArea: string // e.g., "Downtown Austin"
  businessTier: 'unclaimed' | 'free' | 'paid'
  templateType?: TemplateType
  interpretation: DealInterpretation
  /** When the clinic last confirmed this deal's figures, or null. The offer layer fills it. */
  clinicConfirmedAt: string | null
}
