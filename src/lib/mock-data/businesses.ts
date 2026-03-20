import type { Business, BusinessStatus, BusinessTier } from '@/types/business'

// Track dynamically claimed businesses (changes during session)
let dynamicBusinesses: Business[] = []

// Initialize dynamic array on first access
function getDynamicBusinesses(): Business[] {
  if (dynamicBusinesses.length === 0) {
    dynamicBusinesses = [...businesses]
  }
  return dynamicBusinesses
}

/**
 * Get a business by ID
 */
export function getBusinessById(id: string): Business | undefined {
  return getDynamicBusinesses().find((b) => b.id === id)
}

/**
 * Search businesses by name (case-insensitive)
 */
export function searchBusinessesByName(query: string): Business[] {
  const normalizedQuery = query.toLowerCase().trim()
  if (!normalizedQuery) return []

  return getDynamicBusinesses().filter((b) =>
    b.name.toLowerCase().includes(normalizedQuery),
  )
}

/**
 * Get all unclaimed businesses
 */
export function getUnclaimedBusinesses(): Business[] {
  return getDynamicBusinesses().filter((b) => b.tier === 'unclaimed')
}

/**
 * Create a new business listing
 * Returns the new Business object
 */
export function createBusiness(
  data: Omit<
    Business,
    | 'id'
    | 'slug'
    | 'createdAt'
    | 'updatedAt'
    | 'rating'
    | 'reviewCount'
    | 'isVerified'
    | 'tier'
    | 'status'
  >,
): Business {
  const now = new Date().toISOString()
  const slug = data.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  const newBusiness: Business = {
    ...data,
    id: `biz-${Date.now()}`,
    slug: `${slug}-${data.city.toLowerCase()}`,
    tier: 'free',
    status: 'active',
    rating: 0,
    reviewCount: 0,
    isVerified: false,
    createdAt: now,
    updatedAt: now,
  }

  // Add to dynamic businesses
  getDynamicBusinesses().push(newBusiness)

  return newBusiness
}

/**
 * Claim a business for an owner
 * Updates tier, claimedBy, claimedAt, and isVerified
 */
export function claimBusiness(
  businessId: string,
  ownerId: string,
): Business | null {
  const businesses = getDynamicBusinesses()
  const index = businesses.findIndex((b) => b.id === businessId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedBusiness: Business = {
    ...businesses[index],
    tier: 'free',
    claimedBy: ownerId,
    claimedAt: now,
    isVerified: true,
    verifiedAt: now,
    updatedAt: now,
  }

  dynamicBusinesses[index] = updatedBusiness
  return updatedBusiness
}

/**
 * Update a business with partial data
 * Returns the updated business or null if not found
 */
export function updateBusiness(
  businessId: string,
  updates: Partial<
    Omit<
      Business,
      | 'id'
      | 'slug'
      | 'createdAt'
      | 'tier'
      | 'status'
      | 'rating'
      | 'reviewCount'
      | 'isVerified'
      | 'verifiedAt'
      | 'claimedBy'
      | 'claimedAt'
    >
  >,
): Business | null {
  const businesses = getDynamicBusinesses()
  const index = businesses.findIndex((b) => b.id === businessId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedBusiness: Business = {
    ...businesses[index],
    ...updates,
    updatedAt: now,
  }

  dynamicBusinesses[index] = updatedBusiness
  return updatedBusiness
}

export const businesses: Business[] = [
  // Unclaimed businesses (scraped data)
  {
    id: 'biz-1',
    name: 'Glow Aesthetics',
    slug: 'glow-aesthetics-austin',
    description:
      'Premium medical spa offering the latest in aesthetic treatments.',
    tier: 'unclaimed',
    status: 'active',
    address: '123 Congress Ave',
    city: 'Austin',
    state: 'TX',
    zipCode: '78701',
    locationArea: 'Downtown Austin',
    latitude: 30.2672,
    longitude: -97.7431,
    phone: '(512) 555-0101',
    email: 'info@glowaesthetics.com',
    website: 'https://glowaesthetics.com',
    rating: 4.8,
    reviewCount: 127,
    isVerified: false,
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
  },
  {
    id: 'biz-2',
    name: 'Radiance Med Spa',
    slug: 'radiance-med-spa-dallas',
    description: 'Your destination for transformative beauty treatments.',
    tier: 'unclaimed',
    status: 'active',
    address: '456 McKinney Ave',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75201',
    locationArea: 'Uptown Dallas',
    latitude: 32.8067,
    longitude: -96.807,
    phone: '(214) 555-0202',
    email: 'hello@radiancemedspa.com',
    rating: 4.6,
    reviewCount: 89,
    isVerified: false,
    createdAt: '2024-02-01T10:00:00Z',
    updatedAt: '2024-02-01T10:00:00Z',
  },
  // Free tier businesses (claimed)
  {
    id: 'biz-3',
    name: 'Luxe Skin Studio',
    slug: 'luxe-skin-studio-austin',
    description: 'Expert injectors and skincare specialists in North Austin.',
    tier: 'free',
    status: 'active',
    address: '789 Domain Dr',
    city: 'Austin',
    state: 'TX',
    zipCode: '78758',
    locationArea: 'North Austin',
    latitude: 30.3672,
    longitude: -97.7431,
    phone: '(512) 555-0303',
    email: 'appointments@luxeskin.com',
    website: 'https://luxeskinstudio.com',
    logoUrl: '/mock/logos/luxe-skin.png',
    rating: 4.9,
    reviewCount: 203,
    isVerified: true,
    verifiedAt: '2024-03-01T10:00:00Z',
    claimedBy: 'owner-1',
    claimedAt: '2024-02-28T10:00:00Z',
    createdAt: '2024-01-20T10:00:00Z',
    updatedAt: '2024-03-01T10:00:00Z',
  },
  {
    id: 'biz-4',
    name: 'Rejuvenate MedSpa',
    slug: 'rejuvenate-medspa-houston',
    description: 'Advanced aesthetic treatments in The Heights.',
    tier: 'free',
    status: 'active',
    address: '321 Heights Blvd',
    city: 'Houston',
    state: 'TX',
    zipCode: '77008',
    locationArea: 'The Heights',
    latitude: 29.8004,
    longitude: -95.3998,
    phone: '(713) 555-0404',
    email: 'book@rejuvenatemedspa.com',
    rating: 4.7,
    reviewCount: 156,
    isVerified: true,
    verifiedAt: '2024-02-15T10:00:00Z',
    claimedBy: 'owner-2',
    claimedAt: '2024-02-14T10:00:00Z',
    createdAt: '2024-01-25T10:00:00Z',
    updatedAt: '2024-02-15T10:00:00Z',
  },
  // Paid tier businesses (premium features)
  {
    id: 'biz-5',
    name: 'Elite Aesthetics',
    slug: 'elite-aesthetics-austin',
    description:
      'Award-winning med spa with celebrity clientele. Featured in Austin Monthly.',
    tier: 'paid',
    status: 'active',
    address: '100 South Congress',
    city: 'Austin',
    state: 'TX',
    zipCode: '78704',
    locationArea: 'South Austin',
    latitude: 30.2072,
    longitude: -97.7631,
    phone: '(512) 555-0505',
    email: 'vip@eliteaesthetics.com',
    website: 'https://eliteaesthetics.com',
    logoUrl: '/mock/logos/elite.png',
    coverImageUrl: '/mock/covers/elite-cover.jpg',
    rating: 4.95,
    reviewCount: 412,
    isVerified: true,
    verifiedAt: '2024-01-10T10:00:00Z',
    claimedBy: 'owner-3',
    claimedAt: '2024-01-09T10:00:00Z',
    createdAt: '2024-01-01T10:00:00Z',
    updatedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'biz-6',
    name: 'The Beauty Lab',
    slug: 'the-beauty-lab-dallas',
    description: 'Luxury medical aesthetics in the heart of Dallas.',
    tier: 'paid',
    status: 'active',
    address: '500 Main Street',
    city: 'Dallas',
    state: 'TX',
    zipCode: '75201',
    locationArea: 'Downtown Dallas',
    latitude: 32.7767,
    longitude: -96.797,
    phone: '(214) 555-0606',
    email: 'concierge@thebeautylab.com',
    website: 'https://thebeautylab.com',
    logoUrl: '/mock/logos/beauty-lab.png',
    coverImageUrl: '/mock/covers/beauty-lab-cover.jpg',
    rating: 4.85,
    reviewCount: 289,
    isVerified: true,
    verifiedAt: '2024-01-05T10:00:00Z',
    claimedBy: 'owner-4',
    claimedAt: '2024-01-04T10:00:00Z',
    createdAt: '2023-12-01T10:00:00Z',
    updatedAt: '2024-03-10T10:00:00Z',
  },
]

/**
 * Get all businesses
 */
export function getAllBusinesses(): Business[] {
  return getDynamicBusinesses()
}

/**
 * Update business status
 */
export function updateBusinessStatus(
  businessId: string,
  status: BusinessStatus,
): Business | null {
  const businesses = getDynamicBusinesses()
  const index = businesses.findIndex((b) => b.id === businessId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedBusiness: Business = {
    ...businesses[index],
    status,
    updatedAt: now,
  }

  dynamicBusinesses[index] = updatedBusiness
  return updatedBusiness
}

/**
 * Update business tier
 */
export function updateBusinessTier(
  businessId: string,
  tier: BusinessTier,
): Business | null {
  const businesses = getDynamicBusinesses()
  const index = businesses.findIndex((b) => b.id === businessId)

  if (index === -1) return null

  const now = new Date().toISOString()
  const updatedBusiness: Business = {
    ...businesses[index],
    tier,
    updatedAt: now,
  }

  dynamicBusinesses[index] = updatedBusiness
  return updatedBusiness
}
