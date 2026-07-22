import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import type { Offer, OfferWithBusiness } from '@/types/supabase'
import {
  BUSINESS_JOIN,
  enrichOffer,
  enrichOffers,
  OFFER_EMBED,
} from '@/lib/data/offer-query'

const TABLE = 'promo_offer_master'

export interface OfferFilters {
  city?: string
  serviceCategory?: string
  minPrice?: number
  maxPrice?: number
  limit?: number
}

export async function getOffers(filters?: OfferFilters): Promise<Offer[]> {
  let query = supabase
    .from(TABLE)
    .select(`*, ${OFFER_EMBED}`)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

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
  let results = enrichOffers((data ?? []) as Offer[])
  if (filters?.serviceCategory) {
    results = results.filter(
      (offer) => offer.service_category === filters.serviceCategory,
    )
  }
  return results
}

export const getOfferById = cache(async function getOfferById(
  id: number,
): Promise<OfferWithBusiness | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`*, ${OFFER_EMBED}, ${BUSINESS_JOIN}`)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return enrichOffer(data as OfferWithBusiness)
})

const getAllOffersWithBusinesses = cache(
  async function getAllOffersWithBusinesses(): Promise<OfferWithBusiness[]> {
    return _getOffersWithBusinesses()
  },
)

export async function getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferWithBusiness[]> {
  if (!filters || Object.keys(filters).length === 0) {
    return getAllOffersWithBusinesses()
  }
  return _getOffersWithBusinesses(filters)
}

async function _getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferWithBusiness[]> {
  let query = supabase
    .from(TABLE)
    .select(`*, ${OFFER_EMBED}, ${BUSINESS_JOIN}`)
    .eq('is_active', true)
    .gt('discount_price', 0)
    .gt('regular_price', 0)

  if (filters?.city) {
    const { data: cityBusinesses } = await supabase
      .from('master_business_info')
      .select('business_id')
      .ilike('city', filters.city)

    if (!cityBusinesses || cityBusinesses.length === 0) return []
    query = query.in(
      'business_id',
      cityBusinesses.map((b) => b.business_id),
    )
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

  let results = enrichOffers((data ?? []) as OfferWithBusiness[])
  if (filters?.serviceCategory) {
    results = results.filter(
      (offer) => offer.service_category === filters.serviceCategory,
    )
  }
  return results.sort((a, b) => {
    const scoreA =
      a.discount_price &&
      a.original_price &&
      a.discount_price < a.original_price
        ? 0
        : a.discount_price && a.discount_price > 0
          ? 1
          : 2
    const scoreB =
      b.discount_price &&
      b.original_price &&
      b.discount_price < b.original_price
        ? 0
        : b.discount_price && b.discount_price > 0
          ? 1
          : 2
    return scoreA - scoreB
  })
}

export const getOfferCategories = cache(
  async function getOfferCategories(): Promise<
    { service_category: string; count: number }[]
  > {
    const { data, error } = await supabase.rpc('get_offer_category_counts')

    if (!error && data) {
      return data as { service_category: string; count: number }[]
    }

    const { data: raw, error: rawError } = await supabase
      .from(TABLE)
      .select(
        'id, promo_offer_items(clinic_services(service_category))',
      )
      .eq('is_active', true)
      .gt('discount_price', 0)

    if (rawError) throw rawError

    const counts = new Map<string, number>()
    for (const row of raw ?? []) {
      const items = row.promo_offer_items
      const list = Array.isArray(items) ? items : items ? [items] : []
      for (const item of list) {
        const service = Array.isArray(item.clinic_services)
          ? item.clinic_services[0]
          : item.clinic_services
        const category = service?.service_category?.trim()
        if (!category) continue
        counts.set(category, (counts.get(category) ?? 0) + 1)
      }
    }

    return Array.from(counts.entries())
      .map(([service_category, count]) => ({ service_category, count }))
      .sort((a, b) => b.count - a.count)
  },
)

export const getOffersByBusiness = cache(async function getOffersByBusiness(
  businessId: number,
): Promise<Offer[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`*, ${OFFER_EMBED}`)
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) throw error
  return enrichOffers((data ?? []) as Offer[])
})

export const getFeaturedOffers = cache(async function getFeaturedOffers(
  limit = 6,
): Promise<OfferWithBusiness[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(`*, ${OFFER_EMBED}, ${BUSINESS_JOIN}`)
    .eq('is_active', true)
    .gt('discount_price', 0)
    .gt('regular_price', 0)
    .order('discount_percent', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) throw error

  const results = enrichOffers((data ?? []) as OfferWithBusiness[])
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
})
