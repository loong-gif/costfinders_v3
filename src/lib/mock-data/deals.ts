import type { AnonymousDeal, Deal, ModerationStatus } from '@/types/deal'
import { businesses } from './businesses'

export const deals: Deal[] = [
  // Botox deals
  {
    id: 'deal-1',
    businessId: 'biz-1',
    title: 'Botox Special',
    description:
      "FDA-approved Botox by certified injectors. Perfect for forehead lines, crow's feet, and frown lines.",
    category: 'botox',
    originalPrice: 14,
    dealPrice: 10,
    discountPercent: 29,
    unit: 'per unit',
    minUnits: 20,
    maxUnits: 60,
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions:
      'New clients only. Cannot be combined with other offers.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 45,
    viewCount: 1250,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'deal-2',
    businessId: 'biz-5',
    title: 'Premium Botox Experience',
    description:
      'VIP Botox treatment with complimentary consultation and aftercare kit.',
    category: 'botox',
    originalPrice: 16,
    dealPrice: 12,
    discountPercent: 25,
    unit: 'per unit',
    minUnits: 15,
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions:
      'Includes numbing cream and post-treatment skincare samples.',
    isActive: true,
    isFeatured: true,
    isSponsored: true,
    claimCount: 89,
    viewCount: 3200,
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  // Filler deals
  {
    id: 'deal-3',
    businessId: 'biz-3',
    title: 'Juvederm Lip Filler',
    description: 'Natural-looking lip enhancement with Juvederm Ultra XC.',
    category: 'fillers',
    originalPrice: 650,
    dealPrice: 499,
    discountPercent: 23,
    unit: 'per syringe',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'First syringe only at discounted rate.',
    isActive: true,
    isFeatured: true,
    isSponsored: false,
    claimCount: 67,
    viewCount: 2100,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
  },
  {
    id: 'deal-4',
    businessId: 'biz-2',
    title: 'Cheek Filler Special',
    description: 'Restore volume and contour with premium HA fillers.',
    category: 'fillers',
    originalPrice: 800,
    dealPrice: 599,
    discountPercent: 25,
    unit: 'per syringe',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Includes follow-up appointment.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 34,
    viewCount: 980,
    createdAt: '2024-02-15T10:00:00Z',
    updatedAt: '2024-02-15T10:00:00Z',
  },
  // Facial deals
  {
    id: 'deal-5',
    businessId: 'biz-4',
    title: 'HydraFacial MD',
    description:
      'Deep cleanse, exfoliate, and hydrate with patented technology.',
    category: 'facials',
    originalPrice: 199,
    dealPrice: 149,
    discountPercent: 25,
    unit: 'per session',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Includes LED light therapy add-on.',
    isActive: true,
    isFeatured: true,
    isSponsored: false,
    claimCount: 112,
    viewCount: 2800,
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-01-20T10:00:00Z',
  },
  {
    id: 'deal-6',
    businessId: 'biz-6',
    title: 'Signature Luxury Facial',
    description: '90-minute customized facial with premium products.',
    category: 'facials',
    originalPrice: 275,
    dealPrice: 199,
    discountPercent: 28,
    unit: 'per session',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Includes take-home skincare sample set.',
    isActive: true,
    isFeatured: false,
    isSponsored: true,
    claimCount: 78,
    viewCount: 1900,
    createdAt: '2024-02-10T10:00:00Z',
    updatedAt: '2024-02-10T10:00:00Z',
  },
  // Laser deals
  {
    id: 'deal-7',
    businessId: 'biz-1',
    title: 'Laser Hair Removal - Small Area',
    description:
      'Permanent hair reduction for underarms, bikini line, or upper lip.',
    category: 'laser',
    originalPrice: 150,
    dealPrice: 99,
    discountPercent: 34,
    unit: 'per session',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Package of 6 sessions recommended. Price per session.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 156,
    viewCount: 4200,
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-01-25T10:00:00Z',
  },
  {
    id: 'deal-8',
    businessId: 'biz-5',
    title: 'IPL Photofacial',
    description:
      'Treat sun damage, age spots, and redness with intense pulsed light.',
    category: 'laser',
    originalPrice: 350,
    dealPrice: 249,
    discountPercent: 29,
    unit: 'per session',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Series of 3 treatments recommended.',
    isActive: true,
    isFeatured: true,
    isSponsored: true,
    claimCount: 45,
    viewCount: 1600,
    createdAt: '2024-02-05T10:00:00Z',
    updatedAt: '2024-02-05T10:00:00Z',
  },
  // More deals for variety
  {
    id: 'deal-9',
    businessId: 'biz-3',
    title: 'Dysport Special',
    description: 'Alternative to Botox with faster onset.',
    category: 'botox',
    originalPrice: 5,
    dealPrice: 3.5,
    discountPercent: 30,
    unit: 'per unit',
    minUnits: 50,
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Minimum 50 units required.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 23,
    viewCount: 780,
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'deal-10',
    businessId: 'biz-4',
    title: 'Chemical Peel Package',
    description: 'Series of 3 progressive chemical peels for skin renewal.',
    category: 'facials',
    originalPrice: 450,
    dealPrice: 299,
    discountPercent: 34,
    unit: 'per package',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: '3 sessions, scheduled 4 weeks apart.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 41,
    viewCount: 1100,
    createdAt: '2024-02-20T10:00:00Z',
    updatedAt: '2024-02-20T10:00:00Z',
  },
  {
    id: 'deal-11',
    businessId: 'biz-6',
    title: 'Full Face Filler Package',
    description:
      'Comprehensive facial balancing with 3 syringes of premium filler.',
    category: 'fillers',
    originalPrice: 2400,
    dealPrice: 1799,
    discountPercent: 25,
    unit: 'per package',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions:
      'Includes cheeks, lips, and jawline. Consultation required.',
    isActive: true,
    isFeatured: true,
    isSponsored: true,
    claimCount: 28,
    viewCount: 2400,
    createdAt: '2024-03-05T10:00:00Z',
    updatedAt: '2024-03-05T10:00:00Z',
  },
  {
    id: 'deal-12',
    businessId: 'biz-2',
    title: 'Laser Skin Resurfacing',
    description: 'Fractional CO2 laser for wrinkles, scars, and texture.',
    category: 'laser',
    originalPrice: 1200,
    dealPrice: 899,
    discountPercent: 25,
    unit: 'per session',
    validFrom: '2024-01-01T00:00:00Z',
    validUntil: '2024-12-31T23:59:59Z',
    termsAndConditions: 'Requires 1 week downtime. Consultation required.',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 12,
    viewCount: 650,
    createdAt: '2024-03-10T10:00:00Z',
    updatedAt: '2024-03-10T10:00:00Z',
  },
  // Deals pending moderation
  {
    id: 'deal-13',
    businessId: 'biz-1',
    title: 'Spring Botox Special',
    description: 'Limited time spring promotion. Get natural-looking results with our expert injectors.',
    category: 'botox',
    originalPrice: 15,
    dealPrice: 11,
    discountPercent: 27,
    unit: 'per unit',
    minUnits: 20,
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-05-31T23:59:59Z',
    termsAndConditions: 'Spring promotion. New and existing clients welcome.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-15T10:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    moderationStatus: 'pending_review',
  },
  {
    id: 'deal-14',
    businessId: 'biz-5',
    title: 'Lip Filler VIP Package',
    description: 'Premium lip enhancement with 1ml of Juvederm Volbella. Includes consultation and aftercare.',
    category: 'fillers',
    originalPrice: 700,
    dealPrice: 549,
    discountPercent: 22,
    unit: 'per syringe',
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-06-30T23:59:59Z',
    termsAndConditions: 'VIP package includes numbing and post-care kit.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-15T09:30:00Z',
    updatedAt: '2024-03-15T09:30:00Z',
    moderationStatus: 'pending_review',
  },
  {
    id: 'deal-15',
    businessId: 'biz-3',
    title: 'HydraFacial Glow Bundle',
    description: 'Three-session HydraFacial package for ultimate skin rejuvenation.',
    category: 'facials',
    originalPrice: 525,
    dealPrice: 399,
    discountPercent: 24,
    unit: 'per package',
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-06-30T23:59:59Z',
    termsAndConditions: 'Package of 3 sessions. Must be used within 90 days.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-14T16:45:00Z',
    updatedAt: '2024-03-14T16:45:00Z',
    moderationStatus: 'pending_review',
  },
  {
    id: 'deal-16',
    businessId: 'biz-2',
    title: 'Full Body Laser Package',
    description: 'Complete laser hair removal for legs, arms, underarms, and bikini.',
    category: 'laser',
    originalPrice: 2500,
    dealPrice: 1799,
    discountPercent: 28,
    unit: 'per package',
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-08-31T23:59:59Z',
    termsAndConditions: '6 sessions included. Sessions spaced 6-8 weeks apart.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-14T14:20:00Z',
    updatedAt: '2024-03-14T14:20:00Z',
    moderationStatus: 'pending_review',
  },
  {
    id: 'deal-17',
    businessId: 'biz-4',
    title: 'Microneedling with PRP',
    description: 'Vampire facial combining microneedling with platelet-rich plasma for skin renewal.',
    category: 'facials',
    originalPrice: 800,
    dealPrice: 599,
    discountPercent: 25,
    unit: 'per session',
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-06-30T23:59:59Z',
    termsAndConditions: 'Consultation required. Not suitable for all skin types.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-14T11:00:00Z',
    updatedAt: '2024-03-14T11:00:00Z',
    moderationStatus: 'pending_review',
  },
  {
    id: 'deal-18',
    businessId: 'biz-6',
    title: 'Jawline Contouring Special',
    description: 'Sculpt and define your jawline with dermal filler. Includes 2 syringes.',
    category: 'fillers',
    originalPrice: 1400,
    dealPrice: 999,
    discountPercent: 29,
    unit: 'per treatment',
    validFrom: '2024-03-01T00:00:00Z',
    validUntil: '2024-06-30T23:59:59Z',
    termsAndConditions: 'Includes 2 syringes of premium filler.',
    isActive: false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: '2024-03-13T15:30:00Z',
    updatedAt: '2024-03-13T15:30:00Z',
    moderationStatus: 'pending_review',
  },
]

// Track dynamically created/modified deals (changes during session)
let dynamicDeals: Deal[] = []

// Initialize dynamic array on first access
function getDynamicDeals(): Deal[] {
  if (dynamicDeals.length === 0) {
    dynamicDeals = [...deals]
  }
  return dynamicDeals
}

// Helper to convert Deal to AnonymousDeal (hides business details)
export function toAnonymousDeal(deal: Deal): AnonymousDeal {
  const business = businesses.find((b) => b.id === deal.businessId)
  if (!business) throw new Error(`Business not found: ${deal.businessId}`)

  const { businessId, ...rest } = deal
  return {
    ...rest,
    locationArea: business.locationArea,
    businessRating: business.rating,
    businessReviewCount: business.reviewCount,
    businessTier: business.tier,
  }
}

/**
 * Get all deals for a specific business
 */
export function getDealsForBusiness(businessId: string): Deal[] {
  return getDynamicDeals().filter((d) => d.businessId === businessId)
}

/**
 * Get a single deal by ID
 */
export function getDealById(dealId: string): Deal | undefined {
  return getDynamicDeals().find((d) => d.id === dealId)
}

/**
 * Toggle deal active status (pause/activate)
 */
export function toggleDealStatus(dealId: string): Deal | null {
  const allDeals = getDynamicDeals()
  const index = allDeals.findIndex((d) => d.id === dealId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedDeal: Deal = {
    ...allDeals[index],
    isActive: !allDeals[index].isActive,
    updatedAt: now,
  }

  dynamicDeals[index] = updatedDeal
  return updatedDeal
}

/**
 * Delete a deal by ID
 */
export function deleteDeal(dealId: string): boolean {
  const allDeals = getDynamicDeals()
  const index = allDeals.findIndex((d) => d.id === dealId)

  if (index === -1) return false

  dynamicDeals.splice(index, 1)
  return true
}

/**
 * Create a new deal
 */
export function createDeal(
  data: Omit<Deal, 'id' | 'createdAt' | 'updatedAt' | 'claimCount' | 'viewCount' | 'isSponsored'>
): Deal {
  const now = new Date().toISOString()

  const newDeal: Deal = {
    ...data,
    id: `deal-${Date.now()}`,
    claimCount: 0,
    viewCount: 0,
    isSponsored: false,
    createdAt: now,
    updatedAt: now,
  }

  getDynamicDeals().push(newDeal)
  return newDeal
}

/**
 * Update an existing deal
 */
export function updateDeal(
  dealId: string,
  data: Partial<Omit<Deal, 'id' | 'createdAt' | 'claimCount' | 'viewCount' | 'isSponsored'>>
): Deal | null {
  const allDeals = getDynamicDeals()
  const index = allDeals.findIndex((d) => d.id === dealId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedDeal: Deal = {
    ...allDeals[index],
    ...data,
    updatedAt: now,
  }

  dynamicDeals[index] = updatedDeal
  return updatedDeal
}

/**
 * Update deal moderation status
 */
export function updateDealModeration(
  dealId: string,
  status: ModerationStatus,
  notes?: string
): Deal | null {
  const allDeals = getDynamicDeals()
  const index = allDeals.findIndex((d) => d.id === dealId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedDeal: Deal = {
    ...allDeals[index],
    moderationStatus: status,
    moderationNotes: notes,
    // If approved, activate the deal
    isActive: status === 'approved' ? true : allDeals[index].isActive,
    updatedAt: now,
  }

  dynamicDeals[index] = updatedDeal
  return updatedDeal
}

/**
 * Get all deals (for admin moderation view)
 */
export function getAllDeals(): Deal[] {
  return getDynamicDeals()
}

/**
 * Get all active deals for a specific category
 */
export function getDealsForCategory(categorySlug: string): Deal[] {
  return getDynamicDeals().filter(
    (d) => d.category === categorySlug && d.isActive
  )
}

/**
 * Get all deal IDs with their updatedAt timestamps for sitemap generation
 * Only returns active, approved deals
 */
export function getAllDealIds(): Array<{ id: string; updatedAt: string }> {
  return getDynamicDeals()
    .filter((d) => d.isActive && (!d.moderationStatus || d.moderationStatus === 'approved'))
    .map((d) => ({ id: d.id, updatedAt: d.updatedAt }))
}
