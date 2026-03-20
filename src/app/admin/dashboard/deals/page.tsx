import { dbCategoryToTreatment } from '@/lib/data/adapters'
import { getOffersWithBusinesses } from '@/lib/data/offers'
import type { Deal } from '@/types/deal'
import { DealModerationClient } from './dealsClient'

export const dynamic = 'force-dynamic'

export default async function DealModerationPage() {
  // Fetch real offers from Supabase
  const offers = await getOffersWithBusinesses()

  // Map Supabase offers to frontend Deal type for DealModerationCard
  const deals: Deal[] = offers.map((offer) => ({
    id: String(offer.id),
    businessId: String(offer.business_id ?? 0),
    title:
      offer.service_name ??
      offer.offer_raw_text?.slice(0, 60) ??
      'Special Offer',
    description:
      offer.offer_raw_text ??
      `${offer.service_name ?? 'Treatment'} — ${offer.template_type ?? 'deal'}`,
    category: dbCategoryToTreatment(offer.service_category),
    originalPrice: offer.original_price ?? 0,
    dealPrice: offer.discount_price ?? offer.original_price ?? 0,
    discountPercent: offer.discount_percent ?? 0,
    unit: offer.unit_type ?? 'per treatment',
    validFrom:
      offer.start_date ?? offer.created_at ?? new Date().toISOString(),
    validUntil: offer.end_date ?? '',
    termsAndConditions: offer.eligibility ?? '',
    isActive: true,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: offer.created_at ?? new Date().toISOString(),
    updatedAt: offer.created_at ?? new Date().toISOString(),
    moderationStatus: 'approved' as const,
  }))

  return <DealModerationClient initialDeals={deals} />
}
