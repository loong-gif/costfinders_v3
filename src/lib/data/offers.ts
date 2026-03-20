import { supabase } from '@/lib/supabase'
import type { Offer, OfferWithBusiness } from '@/types/supabase'

const TABLE = 'promo_offer_master'

const BUSINESS_JOIN =
  'master_business_info(business_id, name, address, city, score, review_count, category, website_clean)'

export interface OfferFilters {
  city?: string
  serviceCategory?: string
  minPrice?: number
  maxPrice?: number
  templateType?: string
  limit?: number
}

export async function getOffers(filters?: OfferFilters): Promise<Offer[]> {
  let query = supabase
    .from(TABLE)
    .select('*')
    .order('created_at', { ascending: false })

  if (filters?.serviceCategory) {
    query = query.eq('service_category', filters.serviceCategory)
  }
  if (filters?.templateType) {
    query = query.eq('template_type', filters.templateType)
  }
  if (filters?.minPrice != null) {
    query = query.gte('discount_price', filters.minPrice)
  }
  if (filters?.maxPrice != null) {
    query = query.lte('discount_price', filters.maxPrice)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Offer[]
}

export async function getOfferById(
  id: number,
): Promise<OfferWithBusiness | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`*, ${BUSINESS_JOIN}`)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as OfferWithBusiness
}

export async function getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferWithBusiness[]> {
  let query = supabase
    .from(TABLE)
    .select(`*, ${BUSINESS_JOIN}`)
    .order('created_at', { ascending: false })

  if (filters?.city) {
    query = query.eq('master_business_info.city', filters.city)
  }
  if (filters?.serviceCategory) {
    query = query.eq('service_category', filters.serviceCategory)
  }
  if (filters?.minPrice != null) {
    query = query.gte('discount_price', filters.minPrice)
  }
  if (filters?.maxPrice != null) {
    query = query.lte('discount_price', filters.maxPrice)
  }
  if (filters?.limit) {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as OfferWithBusiness[]
}

export async function getOfferCategories(): Promise<
  { service_category: string; count: number }[]
> {
  const { data, error } = await supabase.from(TABLE).select('service_category')

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.service_category) continue
    counts.set(
      row.service_category,
      (counts.get(row.service_category) ?? 0) + 1,
    )
  }

  return Array.from(counts.entries())
    .map(([service_category, count]) => ({ service_category, count }))
    .sort((a, b) => b.count - a.count)
}

export async function getOffersByBusiness(
  businessId: number,
): Promise<Offer[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as Offer[]
}

export async function getFeaturedOffers(
  limit = 6,
): Promise<OfferWithBusiness[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`*, ${BUSINESS_JOIN}`)
    .not('discount_price', 'is', null)
    .not('original_price', 'is', null)
    .order('discount_percent', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error

  // Sort by savings (original - discount), biggest savings first
  const results = (data ?? []) as OfferWithBusiness[]
  return results.sort((a, b) => {
    const savingsA =
      a.original_price && a.discount_price
        ? a.original_price - a.discount_price
        : 0
    const savingsB =
      b.original_price && b.discount_price
        ? b.original_price - b.discount_price
        : 0
    return savingsB - savingsA
  })
}
