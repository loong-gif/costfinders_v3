import type { Deal } from '@/types/deal'

export interface BoostOption {
  id: string
  name: string
  duration: number // days
  price: number
  impressionMultiplier: number
  hasFeaturedBadge: boolean
  description: string
}

export interface ActiveBoost {
  id: string
  dealId: string
  boostOptionId: string
  startDate: string
  endDate: string
  impressionsDelivered: number
  totalCost: number
  status: 'active' | 'completed' | 'cancelled'
}

export interface BoostHistory {
  id: string
  dealId: string
  dealTitle: string
  boostName: string
  startDate: string
  endDate: string
  impressionsDelivered: number
  totalCost: number
  status: 'completed' | 'cancelled'
}

// Boost options available for purchase
const boostOptions: BoostOption[] = [
  {
    id: 'boost-7',
    name: '7-Day Boost',
    duration: 7,
    price: 29,
    impressionMultiplier: 2,
    hasFeaturedBadge: false,
    description: 'Double your deal visibility for a week',
  },
  {
    id: 'boost-14',
    name: '14-Day Boost',
    duration: 14,
    price: 49,
    impressionMultiplier: 3,
    hasFeaturedBadge: false,
    description: 'Triple impressions with extended reach',
  },
  {
    id: 'boost-30',
    name: '30-Day Featured',
    duration: 30,
    price: 99,
    impressionMultiplier: 5,
    hasFeaturedBadge: true,
    description: '5x visibility plus featured badge placement',
  },
]

// Track active boosts
let activeBoosts: ActiveBoost[] = [
  {
    id: 'ab-1',
    dealId: 'deal-2',
    boostOptionId: 'boost-30',
    startDate: '2025-01-05T00:00:00Z',
    endDate: '2025-02-04T23:59:59Z',
    impressionsDelivered: 8420,
    totalCost: 99,
    status: 'active',
  },
  {
    id: 'ab-2',
    dealId: 'deal-6',
    boostOptionId: 'boost-14',
    startDate: '2025-01-08T00:00:00Z',
    endDate: '2025-01-22T23:59:59Z',
    impressionsDelivered: 4250,
    totalCost: 49,
    status: 'active',
  },
]

// Boost history
const boostHistory: BoostHistory[] = [
  {
    id: 'bh-1',
    dealId: 'deal-8',
    dealTitle: 'IPL Photofacial',
    boostName: '7-Day Boost',
    startDate: '2024-12-15T00:00:00Z',
    endDate: '2024-12-22T23:59:59Z',
    impressionsDelivered: 3200,
    totalCost: 29,
    status: 'completed',
  },
  {
    id: 'bh-2',
    dealId: 'deal-11',
    dealTitle: 'Full Face Filler Package',
    boostName: '30-Day Featured',
    startDate: '2024-11-01T00:00:00Z',
    endDate: '2024-12-01T23:59:59Z',
    impressionsDelivered: 12000,
    totalCost: 99,
    status: 'completed',
  },
  {
    id: 'bh-3',
    dealId: 'deal-5',
    dealTitle: 'HydraFacial MD',
    boostName: '14-Day Boost',
    startDate: '2024-10-20T00:00:00Z',
    endDate: '2024-11-03T23:59:59Z',
    impressionsDelivered: 5600,
    totalCost: 49,
    status: 'completed',
  },
]

/**
 * Get all available boost options
 */
export function getBoostOptions(): BoostOption[] {
  return [...boostOptions]
}

/**
 * Get a specific boost option by ID
 */
export function getBoostOptionById(id: string): BoostOption | undefined {
  return boostOptions.find((opt) => opt.id === id)
}

/**
 * Get all active boosts for a business
 */
export function getActiveBoosts(businessId: string): ActiveBoost[] {
  return activeBoosts.filter((boost) => boost.status === 'active')
}

/**
 * Get active boost for a specific deal
 */
export function getActiveBoostForDeal(dealId: string): ActiveBoost | undefined {
  return activeBoosts.find(
    (boost) => boost.dealId === dealId && boost.status === 'active'
  )
}

/**
 * Get boost history for a business
 */
export function getBoostHistory(businessId: string): BoostHistory[] {
  return [...boostHistory]
}

/**
 * Calculate estimated reach based on current views and multiplier
 */
export function calculateEstimatedReach(
  currentViews: number,
  multiplier: number,
  duration: number
): number {
  // Estimate daily views from current total (assuming 30-day average)
  const dailyViews = currentViews / 30
  return Math.round(dailyViews * multiplier * duration)
}

/**
 * Create a new boost for a deal
 */
export function createBoost(
  dealId: string,
  boostOptionId: string
): ActiveBoost | null {
  const option = getBoostOptionById(boostOptionId)
  if (!option) return null

  // Check if deal already has an active boost
  if (getActiveBoostForDeal(dealId)) return null

  const now = new Date()
  const endDate = new Date(now)
  endDate.setDate(endDate.getDate() + option.duration)

  const newBoost: ActiveBoost = {
    id: `ab-${Date.now()}`,
    dealId,
    boostOptionId,
    startDate: now.toISOString(),
    endDate: endDate.toISOString(),
    impressionsDelivered: 0,
    totalCost: option.price,
    status: 'active',
  }

  activeBoosts.push(newBoost)
  return newBoost
}

/**
 * Cancel an active boost early
 */
export function cancelBoost(boostId: string): boolean {
  const index = activeBoosts.findIndex((b) => b.id === boostId)
  if (index === -1) return false

  activeBoosts[index].status = 'cancelled'
  return true
}

/**
 * Calculate days remaining for an active boost
 */
export function getDaysRemaining(boost: ActiveBoost): number {
  const now = new Date()
  const endDate = new Date(boost.endDate)
  const diffTime = endDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(0, diffDays)
}

/**
 * Calculate boost progress percentage
 */
export function getBoostProgress(boost: ActiveBoost): number {
  const startDate = new Date(boost.startDate)
  const endDate = new Date(boost.endDate)
  const now = new Date()

  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = now.getTime() - startDate.getTime()

  return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100))
}

/**
 * Check if a deal is eligible for sponsorship
 */
export function isDealEligibleForSponsorship(deal: Deal): boolean {
  // Must be active, approved, and not already sponsored
  return (
    deal.isActive &&
    deal.moderationStatus === 'approved' &&
    !getActiveBoostForDeal(deal.id)
  )
}
