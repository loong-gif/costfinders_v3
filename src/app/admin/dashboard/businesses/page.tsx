import { inferState } from '@/lib/data/adapters'
import { getBusinesses } from '@/lib/data/businesses'
import type { Business } from '@/types/business'
import { BusinessesManagementClient } from './businessesClient'

export const dynamic = 'force-dynamic'

export default async function BusinessesManagementPage() {
  // Fetch real businesses from Supabase
  const supaBusinesses = await getBusinesses()

  // Map Supabase business shape to frontend Business type
  const businesses: Business[] = supaBusinesses.map((biz) => {
    const { state, stateCode } = inferState(biz.city)
    const slug = (biz.name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')

    return {
      id: String(biz.business_id),
      name: biz.name ?? 'Unknown Business',
      slug,
      description: `${biz.category ?? 'Medical spa'} in ${biz.city ?? 'your area'}`,
      tier: 'unclaimed' as const,
      status: 'active' as const,
      address: biz.address ?? '',
      city: biz.city ?? '',
      state: stateCode || state,
      zipCode: '',
      locationArea: biz.city ?? '',
      latitude: 0,
      longitude: 0,
      phone: '',
      email: '',
      website: biz.website_clean ?? biz.website ?? undefined,
      rating: biz.score ?? 0,
      reviewCount: biz.review_count ?? 0,
      isVerified: false,
      createdAt: biz.created_at ?? new Date().toISOString(),
      updatedAt: biz.updated_at ?? new Date().toISOString(),
    }
  })

  return <BusinessesManagementClient initialBusinesses={businesses} />
}
