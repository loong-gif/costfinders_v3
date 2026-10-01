// Platform-wide pricing and monetization settings mock data

export type BillingStatus = 'active' | 'suspended' | 'comped'

/**
 * Proposed bulk lead-credit packages. NOT a balance, NOT a purchase path, NOT anything a
 * business is charged.
 *
 * Inlined from the deleted ./leadPricing, which existed only for this. Everything else that
 * file held is gone with the commerce removal: a module-level `businessCredits` object and a
 * `purchaseCredits()` that incremented it in the browser tab so leadPurchaseModal could say
 * "Purchase complete!" over a Stripe trust mark, plus a per-tier price list and four helpers
 * nothing outside the barrel ever called. No processor exists and nothing was ever charged.
 *
 * The one reader is the admin monetization screen, which labels these as proposals and writes
 * nowhere. Whatever the real prices turn out to be, they belong in the database with the rest
 * of the pricing, not here.
 */
export interface CreditPackage {
  id: string
  credits: number
  price: number
  pricePerLead: number
  savingsPercent: number
  isBestValue: boolean
}

const creditPackages: CreditPackage[] = [
  {
    id: 'pkg_10',
    credits: 10,
    price: 45,
    pricePerLead: 4.5,
    savingsPercent: 10,
    isBestValue: false,
  },
  {
    id: 'pkg_25',
    credits: 25,
    price: 100,
    pricePerLead: 4.0,
    savingsPercent: 20,
    isBestValue: false,
  },
  {
    id: 'pkg_50',
    credits: 50,
    price: 175,
    pricePerLead: 3.5,
    savingsPercent: 30,
    isBestValue: false,
  },
  {
    id: 'pkg_100',
    credits: 100,
    price: 300,
    pricePerLead: 3.0,
    savingsPercent: 40,
    isBestValue: true,
  },
]

export interface TierPricing {
  free: number
  paid: number
}

export interface LeadPricingByTier {
  free: number
  paid: number
}

export interface SponsorshipPricing {
  sevenDay: number
  fourteenDay: number
  thirtyDay: number
}

export interface PlatformFees {
  transactionFee: number // e.g., 0.029 = 2.9%
  platformFee: number // e.g., 0.02 = 2%
}

export interface TierFeature {
  id: string
  name: string
  freeIncluded: boolean
  paidIncluded: boolean
}

export interface PlatformSettings {
  tierPricing: TierPricing
  leadPricingByTier: LeadPricingByTier
  creditPackages: CreditPackage[]
  sponsorshipPricing: SponsorshipPricing
  platformFees: PlatformFees
  tierFeatures: TierFeature[]
  updatedAt: string
}

export interface BillingOverride {
  id: string
  businessId: string
  previousTier: string
  newTier: string
  previousBillingStatus?: BillingStatus
  newBillingStatus?: BillingStatus
  creditsGranted?: number
  customLeadPrice?: number
  reason: string
  createdBy: string
  createdAt: string
}

// Default tier features
const tierFeatures: TierFeature[] = [
  {
    id: 'feat-1',
    name: 'Basic listing',
    freeIncluded: true,
    paidIncluded: true,
  },
  {
    id: 'feat-2',
    name: 'Deal posting (3/month)',
    freeIncluded: true,
    paidIncluded: true,
  },
  {
    id: 'feat-3',
    name: 'Lead notifications',
    freeIncluded: true,
    paidIncluded: true,
  },
  {
    id: 'feat-4',
    name: 'Unlimited deals',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-5',
    name: 'Priority placement',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-6',
    name: 'Analytics dashboard',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-7',
    name: 'Verified badge',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-8',
    name: 'Featured deals',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-9',
    name: 'Custom branding',
    freeIncluded: false,
    paidIncluded: true,
  },
  {
    id: 'feat-10',
    name: 'Dedicated support',
    freeIncluded: false,
    paidIncluded: true,
  },
]

// Platform settings singleton
let platformSettings: PlatformSettings = {
  tierPricing: {
    free: 0,
    paid: 99,
  },
  leadPricingByTier: {
    free: 5,
    paid: 3,
  },
  creditPackages: creditPackages.map((pkg) => ({ ...pkg })),
  sponsorshipPricing: {
    sevenDay: 29,
    fourteenDay: 49,
    thirtyDay: 99,
  },
  platformFees: {
    transactionFee: 0.029,
    platformFee: 0.02,
  },
  tierFeatures,
  updatedAt: new Date().toISOString(),
}

// Mock billing overrides history
const billingOverrides: BillingOverride[] = [
  {
    id: 'override-1',
    businessId: 'biz-3',
    previousTier: 'unclaimed',
    newTier: 'free',
    reason: 'Business claimed via onboarding',
    createdBy: 'admin-1',
    createdAt: '2024-02-28T10:00:00Z',
  },
  {
    id: 'override-2',
    businessId: 'biz-5',
    previousTier: 'free',
    newTier: 'paid',
    creditsGranted: 50,
    reason: 'Upgraded to paid tier with bonus credits',
    createdBy: 'admin-1',
    createdAt: '2024-01-09T10:00:00Z',
  },
  {
    id: 'override-3',
    businessId: 'biz-5',
    previousTier: 'paid',
    newTier: 'paid',
    previousBillingStatus: 'active',
    newBillingStatus: 'comped',
    reason: 'Partnership promotion - 3 month comp',
    createdBy: 'admin-1',
    createdAt: '2024-03-01T10:00:00Z',
  },
]

/**
 * Get current platform settings
 */
export function getPlatformSettings(): PlatformSettings {
  return {
    ...platformSettings,
    creditPackages: [...platformSettings.creditPackages],
    tierFeatures: platformSettings.tierFeatures.map((f) => ({ ...f })),
  }
}

/**
 * Update platform settings
 */
export function updatePlatformSettings(
  updates: Partial<Omit<PlatformSettings, 'updatedAt'>>,
): PlatformSettings {
  platformSettings = {
    ...platformSettings,
    ...updates,
    updatedAt: new Date().toISOString(),
  }
  return getPlatformSettings()
}

/**
 * Update tier pricing
 */
export function updateTierPricing(pricing: Partial<TierPricing>): TierPricing {
  platformSettings.tierPricing = {
    ...platformSettings.tierPricing,
    ...pricing,
  }
  platformSettings.updatedAt = new Date().toISOString()
  return { ...platformSettings.tierPricing }
}

/**
 * Update lead pricing by tier
 */
export function updateLeadPricing(
  pricing: Partial<LeadPricingByTier>,
): LeadPricingByTier {
  platformSettings.leadPricingByTier = {
    ...platformSettings.leadPricingByTier,
    ...pricing,
  }
  platformSettings.updatedAt = new Date().toISOString()
  return { ...platformSettings.leadPricingByTier }
}

/**
 * Update sponsorship pricing
 */
export function updateSponsorshipPricing(
  pricing: Partial<SponsorshipPricing>,
): SponsorshipPricing {
  platformSettings.sponsorshipPricing = {
    ...platformSettings.sponsorshipPricing,
    ...pricing,
  }
  platformSettings.updatedAt = new Date().toISOString()
  return { ...platformSettings.sponsorshipPricing }
}

/**
 * Update platform fees
 */
export function updatePlatformFees(fees: Partial<PlatformFees>): PlatformFees {
  platformSettings.platformFees = {
    ...platformSettings.platformFees,
    ...fees,
  }
  platformSettings.updatedAt = new Date().toISOString()
  return { ...platformSettings.platformFees }
}

/**
 * Get billing overrides for a specific business
 */
export function getBillingOverridesForBusiness(
  businessId: string,
): BillingOverride[] {
  return billingOverrides
    .filter((o) => o.businessId === businessId)
    .map((o) => ({ ...o }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    )
}

/**
 * Create a new billing override
 */
export function createBillingOverride(
  override: Omit<BillingOverride, 'id' | 'createdAt'>,
): BillingOverride {
  const newOverride: BillingOverride = {
    ...override,
    id: `override-${Date.now()}`,
    createdAt: new Date().toISOString(),
  }
  billingOverrides.push(newOverride)
  return { ...newOverride }
}

/**
 * Calculate effective price after fees
 */
export function calculateEffectivePrice(basePrice: number): {
  total: number
  transactionFee: number
  platformFee: number
  netRevenue: number
} {
  const { transactionFee, platformFee } = platformSettings.platformFees
  const transactionFeeAmount = basePrice * transactionFee
  const platformFeeAmount = basePrice * platformFee
  const netRevenue = basePrice - transactionFeeAmount - platformFeeAmount

  return {
    total: basePrice,
    transactionFee: transactionFeeAmount,
    platformFee: platformFeeAmount,
    netRevenue,
  }
}
