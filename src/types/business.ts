export type BusinessTier = 'unclaimed' | 'free' | 'paid'
export type BusinessStatus = 'active' | 'pending' | 'suspended'

export interface Business {
  id: string
  name: string
  slug: string
  description: string
  tier: BusinessTier
  status: BusinessStatus
  // Location
  address: string
  city: string
  state: string
  zipCode: string
  locationArea: string // e.g., "Downtown", "North Side"
  latitude: number
  longitude: number
  // Contact
  phone: string
  email: string
  website?: string
  // Profile
  logoUrl?: string
  coverImageUrl?: string
  // Ratings
  rating: number
  reviewCount: number
  // Verification
  isVerified: boolean
  verifiedAt?: string
  claimedBy?: string // consumer/owner userId
  claimedAt?: string
  // Timestamps
  createdAt: string
  updatedAt: string
}
