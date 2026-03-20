import type { BusinessOwner } from '@/types/businessOwner'

/**
 * Pre-seeded business owner accounts for testing
 * These owners are linked to claimed businesses
 */
export const businessOwners: BusinessOwner[] = [
  {
    id: 'owner-1',
    email: 'owner@luxeskin.com',
    firstName: 'Jessica',
    lastName: 'Chen',
    phone: '(310) 555-0101',
    businessId: 'business-3', // Luxe Skin Studio
    verificationStatus: 'verified',
    claimStatus: 'approved',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-02-01T14:30:00Z',
  },
  {
    id: 'owner-2',
    email: 'owner@rejuvenate.com',
    firstName: 'Marcus',
    lastName: 'Williams',
    phone: '(424) 555-0202',
    businessId: 'business-4', // Rejuvenate MedSpa
    verificationStatus: 'verified',
    claimStatus: 'approved',
    createdAt: '2024-01-20T09:00:00Z',
    updatedAt: '2024-02-05T11:15:00Z',
  },
  {
    id: 'owner-3',
    email: 'owner@eliteaesthetics.com',
    firstName: 'Sophia',
    lastName: 'Martinez',
    phone: '(213) 555-0303',
    businessId: 'business-5', // Elite Aesthetics
    verificationStatus: 'verified',
    claimStatus: 'approved',
    createdAt: '2024-02-01T08:00:00Z',
    updatedAt: '2024-02-15T16:45:00Z',
  },
  {
    id: 'owner-4',
    email: 'owner@beautylab.com',
    firstName: 'Daniel',
    lastName: 'Park',
    phone: '(818) 555-0404',
    businessId: 'business-6', // The Beauty Lab
    verificationStatus: 'verified',
    claimStatus: 'approved',
    createdAt: '2024-02-10T12:00:00Z',
    updatedAt: '2024-02-20T09:30:00Z',
  },
  {
    id: 'owner-5',
    email: 'pending@medspa.com',
    firstName: 'Amanda',
    lastName: 'Johnson',
    verificationStatus: 'pending',
    claimStatus: 'pending',
    createdAt: '2024-03-01T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'owner-6',
    email: 'new@business.com',
    firstName: 'Ryan',
    lastName: 'Thompson',
    verificationStatus: 'unverified',
    claimStatus: 'none',
    createdAt: '2024-03-10T14:00:00Z',
    updatedAt: '2024-03-10T14:00:00Z',
  },
]

/**
 * Find a business owner by email
 */
export function findBusinessOwnerByEmail(
  email: string,
): BusinessOwner | undefined {
  return businessOwners.find(
    (owner) => owner.email.toLowerCase() === email.toLowerCase(),
  )
}

/**
 * Find a business owner by ID
 */
export function findBusinessOwnerById(id: string): BusinessOwner | undefined {
  return businessOwners.find((owner) => owner.id === id)
}
