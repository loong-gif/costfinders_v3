import type { Claim, ClaimStatus } from '@/types/claim'
import type { Consumer, ConsumerStatus } from '@/types/consumer'
import { getDealsForBusiness } from './deals'

export const consumers: Consumer[] = [
  {
    id: 'user-1',
    email: 'sarah@example.com',
    phone: '+15125551234',
    firstName: 'Sarah',
    lastName: 'Johnson',
    verificationStatus: 'fully_verified',
    emailVerifiedAt: '2024-02-01T10:00:00Z',
    phoneVerifiedAt: '2024-02-01T10:15:00Z',
    status: 'active',
    locationCity: 'Austin',
    locationState: 'TX',
    alertsEmail: true,
    alertsSms: true,
    favoriteCategories: ['botox', 'facials'],
    createdAt: '2024-02-01T09:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
    lastLoginAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'user-2',
    email: 'mike@example.com',
    firstName: 'Mike',
    verificationStatus: 'email_verified',
    emailVerifiedAt: '2024-03-01T14:00:00Z',
    status: 'active',
    locationCity: 'Dallas',
    locationState: 'TX',
    alertsEmail: true,
    alertsSms: false,
    favoriteCategories: [],
    createdAt: '2024-03-01T13:00:00Z',
    updatedAt: '2024-03-01T14:00:00Z',
  },
  {
    id: 'user-3',
    email: 'new@example.com',
    verificationStatus: 'unverified',
    status: 'active',
    alertsEmail: false,
    alertsSms: false,
    favoriteCategories: [],
    createdAt: '2024-03-15T10:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'user-4',
    email: 'jennifer@example.com',
    phone: '+12145559876',
    firstName: 'Jennifer',
    lastName: 'Martinez',
    verificationStatus: 'fully_verified',
    emailVerifiedAt: '2024-01-15T09:00:00Z',
    phoneVerifiedAt: '2024-01-15T09:30:00Z',
    status: 'active',
    locationCity: 'Houston',
    locationState: 'TX',
    alertsEmail: true,
    alertsSms: true,
    favoriteCategories: ['fillers', 'laser'],
    createdAt: '2024-01-15T08:00:00Z',
    updatedAt: '2024-03-10T14:00:00Z',
    lastLoginAt: '2024-03-10T14:00:00Z',
  },
  {
    id: 'user-5',
    email: 'david@example.com',
    firstName: 'David',
    lastName: 'Chen',
    verificationStatus: 'phone_verified',
    phoneVerifiedAt: '2024-02-20T11:00:00Z',
    status: 'suspended',
    locationCity: 'Austin',
    locationState: 'TX',
    alertsEmail: false,
    alertsSms: true,
    favoriteCategories: ['botox'],
    createdAt: '2024-02-20T10:00:00Z',
    updatedAt: '2024-03-05T16:00:00Z',
  },
  {
    id: 'user-6',
    email: 'ashley@example.com',
    phone: '+15125554321',
    firstName: 'Ashley',
    lastName: 'Williams',
    verificationStatus: 'email_verified',
    emailVerifiedAt: '2024-03-08T15:00:00Z',
    status: 'active',
    locationCity: 'San Antonio',
    locationState: 'TX',
    alertsEmail: true,
    alertsSms: false,
    favoriteCategories: ['facials'],
    createdAt: '2024-03-08T14:00:00Z',
    updatedAt: '2024-03-12T09:00:00Z',
    lastLoginAt: '2024-03-12T09:00:00Z',
  },
  {
    id: 'user-7',
    email: 'robert@example.com',
    firstName: 'Robert',
    verificationStatus: 'unverified',
    status: 'active',
    alertsEmail: false,
    alertsSms: false,
    favoriteCategories: [],
    createdAt: '2024-03-14T12:00:00Z',
    updatedAt: '2024-03-14T12:00:00Z',
  },
]

export const claims: Claim[] = [
  {
    id: 'claim-1',
    dealId: 'deal-1',
    consumerId: 'user-1',
    businessId: 'biz-1',
    status: 'completed',
    preferredDate: '2024-02-15',
    preferredTime: '10:00 AM',
    notes: 'First time getting Botox, a bit nervous!',
    businessResponse:
      'Looking forward to seeing you! Our injector will walk you through everything.',
    respondedAt: '2024-02-02T09:00:00Z',
    bookedDate: '2024-02-15',
    bookedTime: '10:30 AM',
    createdAt: '2024-02-01T11:00:00Z',
    updatedAt: '2024-02-15T12:00:00Z',
    expiresAt: '2024-02-08T11:00:00Z',
  },
  {
    id: 'claim-2',
    dealId: 'deal-5',
    consumerId: 'user-1',
    businessId: 'biz-4',
    status: 'booked',
    preferredDate: '2024-03-20',
    preferredTime: '2:00 PM',
    businessResponse: 'Confirmed for March 20th at 2 PM!',
    respondedAt: '2024-03-16T10:00:00Z',
    bookedDate: '2024-03-20',
    bookedTime: '2:00 PM',
    createdAt: '2024-03-15T15:00:00Z',
    updatedAt: '2024-03-16T10:00:00Z',
    expiresAt: '2024-03-22T15:00:00Z',
  },
  {
    id: 'claim-3',
    dealId: 'deal-3',
    consumerId: 'user-1',
    businessId: 'biz-3',
    status: 'pending',
    preferredDate: '2024-03-25',
    preferredTime: 'Afternoon',
    notes: 'Flexible on exact time',
    createdAt: '2024-03-15T16:00:00Z',
    updatedAt: '2024-03-15T16:00:00Z',
    expiresAt: '2024-03-22T16:00:00Z',
  },
  {
    id: 'claim-4',
    dealId: 'deal-2',
    consumerId: 'user-2',
    businessId: 'biz-5',
    status: 'contacted',
    preferredDate: '2024-03-18',
    businessResponse:
      'Thanks for your interest! We have availability on the 18th. What time works for you?',
    respondedAt: '2024-03-16T11:00:00Z',
    createdAt: '2024-03-15T09:00:00Z',
    updatedAt: '2024-03-16T11:00:00Z',
    expiresAt: '2024-03-22T09:00:00Z',
  },
]

// Track dynamically created/modified claims (changes during session)
let dynamicClaims: Claim[] = []

// Initialize dynamic array on first access
function getDynamicClaims(): Claim[] {
  if (dynamicClaims.length === 0) {
    dynamicClaims = [...claims]
  }
  return dynamicClaims
}

/**
 * Get all claims for deals belonging to a specific business
 */
export function getClaimsForBusiness(businessId: string): Claim[] {
  const businessDeals = getDealsForBusiness(businessId)
  const businessDealIds = businessDeals.map((d) => d.id)
  return getDynamicClaims().filter((c) => businessDealIds.includes(c.dealId))
}

/**
 * Update claim status
 */
export function updateClaimStatus(claimId: string, status: ClaimStatus): Claim | null {
  const allClaims = getDynamicClaims()
  const index = allClaims.findIndex((c) => c.id === claimId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedClaim: Claim = {
    ...allClaims[index],
    status,
    updatedAt: now,
    // Track when business first responded
    respondedAt: allClaims[index].respondedAt || (status !== 'pending' ? now : undefined),
  }

  dynamicClaims[index] = updatedClaim
  return updatedClaim
}

/**
 * Add business response to a claim
 */
export function addBusinessResponse(claimId: string, response: string): Claim | null {
  const allClaims = getDynamicClaims()
  const index = allClaims.findIndex((c) => c.id === claimId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedClaim: Claim = {
    ...allClaims[index],
    businessResponse: response,
    respondedAt: allClaims[index].respondedAt || now,
    updatedAt: now,
  }

  dynamicClaims[index] = updatedClaim
  return updatedClaim
}

/**
 * Get a single claim by ID (from dynamic array)
 */
export function getClaimByIdDynamic(claimId: string): Claim | undefined {
  return getDynamicClaims().find((c) => c.id === claimId)
}

// Track dynamically modified consumers (changes during session)
let dynamicConsumers: Consumer[] = []

// Initialize dynamic array on first access
function getDynamicConsumers(): Consumer[] {
  if (dynamicConsumers.length === 0) {
    dynamicConsumers = [...consumers]
  }
  return dynamicConsumers
}

/**
 * Get all consumers
 */
export function getAllConsumers(): Consumer[] {
  return getDynamicConsumers()
}

/**
 * Get claims count for a consumer
 */
export function getClaimsCountForConsumer(consumerId: string): number {
  return getDynamicClaims().filter((c) => c.consumerId === consumerId).length
}

/**
 * Update consumer status
 */
export function updateConsumerStatus(
  consumerId: string,
  status: ConsumerStatus
): Consumer | null {
  const allConsumers = getDynamicConsumers()
  const index = allConsumers.findIndex((c) => c.id === consumerId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedConsumer: Consumer = {
    ...allConsumers[index],
    status,
    updatedAt: now,
  }

  dynamicConsumers[index] = updatedConsumer
  return updatedConsumer
}
