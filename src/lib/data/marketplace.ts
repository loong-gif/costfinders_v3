import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import type { OfferWithBusiness, PromoOfferItem } from '@/types/supabase'

const FRESHNESS_DAYS = 30
const PAGE_SIZE = 1000
const OFFER_EMBED =
  'promo_offer_items(offer_item_id,service_id,quantity,unit_price,clinic_services(service_name,service_category,unit_type)),clinic_promotions(source_url,promotion_title)'
const PRICE_QUOTE_EMBED =
  'promo_offer_items(offer_item_id,offer_id,service_id,quantity,unit_price,unit_type,clinic_services(service_name,service_category,unit_type,regular_price)),clinic_promotions(source_url,promotion_title)'
const BUSINESS_JOIN =
  'master_business_info!fk_offer_business(business_id, name, address, city, score, review_count, category, website)'
const SERVICE_BUSINESS_JOIN =
  'master_business_info!fk_service_business(business_id, name, city)'

export type PromotionSignal = 'price' | 'percent' | 'amount'

export interface PublicPromotion extends OfferWithBusiness {
  discountSignal: PromotionSignal
}

export interface PriceComparison {
  city: string
  serviceCategory: string
  units: Array<{
    unitType: string
    providerCount: number
    prices: number[]
    minimum: number
    maximum: number
    median: number | null
  }>
}

export interface PriceQuote {
  offerItemId: number
  offerId: number
  businessId: number
  city: string
  serviceCategory: string
  unitType: string
  effectivePrice: number
}

export interface ParsedPriceFilters {
  city: string | null
  category: string | null
  min: number | null
  max: number | null
  rangeError: string | null
}

export interface PriceFilterOptions {
  cities: string[]
  categories: string[]
}

interface ClinicServicePriceRef {
  service_name: string | null
  service_category: string | null
  unit_type?: string | null
  regular_price?: number | null
}

export interface ClinicServiceWithBusiness {
  service_id: number
  business_id: number | null
  regular_price: number | null
  service_category: string | null
  unit_type: string | null
  service_name: string | null
  master_business_info?:
    | {
        business_id: number
        name: string | null
        city: string | null
      }
    | {
        business_id: number
        name: string | null
        city: string | null
      }[]
    | null
}

function serviceBusinessCity(service: ClinicServiceWithBusiness): string {
  const info = service.master_business_info
  const business = Array.isArray(info) ? (info[0] ?? null) : (info ?? null)
  return business?.city?.trim() || 'Location unavailable'
}

function positive(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function discountAmount(value: unknown): number {
  const match = String(value ?? '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/)
  return match ? positive(match[0]) : 0
}

export function promotionSignal(
  offer: OfferWithBusiness,
): PromotionSignal | null {
  const regular = positive(offer.regular_price)
  const price = positive(offer.discount_price)
  const percent = positive(offer.discount_percent)
  const amount = discountAmount(offer.discount_amount)

  if (regular > 0 && price > 0 && price < regular) return 'price'
  if (regular > 0 && percent > 0 && percent < 100) return 'percent'
  if (regular > 0 && amount > 0 && amount < regular) return 'amount'
  return null
}

export function isRegularPrice(offer: OfferWithBusiness): boolean {
  return positive(offer.regular_price) > 0 && promotionSignal(offer) === null
}

export function summarizeRegularPrices(
  services: ClinicServiceWithBusiness[],
): PriceComparison[] {
  const groups = new Map<string, Map<string, ClinicServiceWithBusiness[]>>()

  for (const service of services) {
    const city = serviceBusinessCity(service)
    const category = service.service_category?.trim() || 'Other services'
    const unitType = service.unit_type?.trim() || 'service'
    const categoryKey = `${city}\u0000${category}`
    const unitGroups =
      groups.get(categoryKey) ?? new Map<string, ClinicServiceWithBusiness[]>()
    unitGroups.set(unitType, [...(unitGroups.get(unitType) ?? []), service])
    groups.set(categoryKey, unitGroups)
  }

  return Array.from(groups, ([key, unitGroups]) => {
    const [city, serviceCategory] = key.split('\u0000')
    const units = Array.from(unitGroups, ([unitType, unitServices]) => {
      const byProvider = new Map<number, number>()
      for (const service of unitServices) {
        if (service.business_id === null) continue
        const price = positive(service.regular_price)
        const existing = byProvider.get(service.business_id)
        if (existing === undefined || price < existing)
          byProvider.set(service.business_id, price)
      }
      const prices = Array.from(byProvider.values()).sort((a, b) => a - b)
      const middle = Math.floor(prices.length / 2)
      const median =
        prices.length >= 3
          ? prices.length % 2 === 0
            ? (prices[middle - 1] + prices[middle]) / 2
            : prices[middle]
          : null

      return {
        unitType,
        providerCount: prices.length,
        prices,
        minimum: prices[0] ?? 0,
        maximum: prices.at(-1) ?? 0,
        median,
      }
    })

    return {
      city,
      serviceCategory,
      units: units.sort((a, b) => a.unitType.localeCompare(b.unitType)),
    }
  }).sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      a.serviceCategory.localeCompare(b.serviceCategory),
  )
}

function quoteItemService(item: PromoOfferItem): ClinicServicePriceRef | null {
  if (!item.clinic_services) return null
  const service = Array.isArray(item.clinic_services)
    ? item.clinic_services[0]
    : item.clinic_services
  return service as ClinicServicePriceRef
}

function offerItems(offer: OfferWithBusiness) {
  const items = offer.promo_offer_items
  if (!items) return []
  return Array.isArray(items) ? items : [items]
}

export function normalizeOfferItemsToQuotes(
  offer: OfferWithBusiness,
): PriceQuote[] {
  const businessId = offer.business_id
  if (businessId === null) return []

  const city =
    offer.master_business_info?.city?.trim() || 'Location unavailable'
  const quotes: PriceQuote[] = []

  for (const item of offerItems(offer)) {
    const service = quoteItemService(item)
    const unitPrice = positive(item.unit_price)
    const catalogPrice = positive(service?.regular_price)
    const effectivePrice = unitPrice > 0 ? unitPrice : catalogPrice
    if (effectivePrice <= 0) continue

    quotes.push({
      offerItemId: item.offer_item_id,
      offerId: offer.id,
      businessId,
      city,
      serviceCategory:
        service?.service_category?.trim() ||
        offer.service_category?.trim() ||
        'Other services',
      unitType:
        service?.unit_type?.trim() ||
        item.unit_type?.trim() ||
        offer.unit_type?.trim() ||
        'service',
      effectivePrice,
    })
  }

  return quotes
}

export function summarizePriceQuotes(quotes: PriceQuote[]): PriceComparison[] {
  const groups = new Map<string, Map<string, PriceQuote[]>>()

  for (const quote of quotes) {
    const categoryKey = `${quote.city}\u0000${quote.serviceCategory}`
    const unitGroups =
      groups.get(categoryKey) ?? new Map<string, PriceQuote[]>()
    unitGroups.set(quote.unitType, [
      ...(unitGroups.get(quote.unitType) ?? []),
      quote,
    ])
    groups.set(categoryKey, unitGroups)
  }

  return Array.from(groups, ([key, unitGroups]) => {
    const [city, serviceCategory] = key.split('\u0000')
    const units = Array.from(unitGroups, ([unitType, unitQuotes]) => {
      const byProvider = new Map<number, number>()
      for (const quote of unitQuotes) {
        const existing = byProvider.get(quote.businessId)
        if (existing === undefined || quote.effectivePrice < existing)
          byProvider.set(quote.businessId, quote.effectivePrice)
      }
      const prices = Array.from(byProvider.values()).sort((a, b) => a - b)
      const middle = Math.floor(prices.length / 2)
      const median =
        prices.length >= 3
          ? prices.length % 2 === 0
            ? (prices[middle - 1] + prices[middle]) / 2
            : prices[middle]
          : null

      return {
        unitType,
        providerCount: prices.length,
        prices,
        minimum: prices[0] ?? 0,
        maximum: prices.at(-1) ?? 0,
        median,
      }
    })

    return {
      city,
      serviceCategory,
      units: units.sort((a, b) => a.unitType.localeCompare(b.unitType)),
    }
  }).sort(
    (a, b) =>
      a.city.localeCompare(b.city) ||
      a.serviceCategory.localeCompare(b.serviceCategory),
  )
}

function paramValue(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  if (params instanceof URLSearchParams) return params.get(key)
  const value = params[key]
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function parseOptionalPrice(raw: string | null): number | null {
  if (!raw?.trim()) return null
  const parsed = Number(raw)
  if (!Number.isFinite(parsed) || parsed < 0) return Number.NaN
  return parsed
}

export function parsePriceFilters(
  params: URLSearchParams | Record<string, string | string[] | undefined>,
): ParsedPriceFilters {
  const city = paramValue(params, 'city')?.trim() || null
  const category = paramValue(params, 'category')?.trim() || null
  const minParsed = parseOptionalPrice(paramValue(params, 'min'))
  const maxParsed = parseOptionalPrice(paramValue(params, 'max'))

  let rangeError: string | null = null
  if (Number.isNaN(minParsed)) {
    rangeError = 'Enter a valid minimum price.'
  } else if (Number.isNaN(maxParsed)) {
    rangeError = 'Enter a valid maximum price.'
  } else if (
    minParsed !== null &&
    maxParsed !== null &&
    minParsed > maxParsed
  ) {
    rangeError = 'Minimum price cannot exceed maximum price.'
  }

  return {
    city,
    category,
    min: Number.isNaN(minParsed) ? null : minParsed,
    max: Number.isNaN(maxParsed) ? null : maxParsed,
    rangeError,
  }
}

export function filterPriceQuotes(
  quotes: PriceQuote[],
  filters: ParsedPriceFilters,
): PriceQuote[] {
  let result = quotes
  if (filters.city) {
    result = result.filter((quote) => quote.city === filters.city)
  }
  if (filters.category) {
    result = result.filter(
      (quote) => quote.serviceCategory === filters.category,
    )
  }
  if (filters.rangeError) return result
  const { min, max } = filters
  if (min !== null) {
    result = result.filter((quote) => quote.effectivePrice >= min)
  }
  if (max !== null) {
    result = result.filter((quote) => quote.effectivePrice <= max)
  }
  return result
}

export function getPriceFilterOptions(
  quotes: PriceQuote[],
): PriceFilterOptions {
  const cities = new Set<string>()
  const categories = new Set<string>()
  for (const quote of quotes) {
    if (quote.city !== 'Location unavailable') cities.add(quote.city)
    categories.add(quote.serviceCategory)
  }
  return {
    cities: Array.from(cities).sort((a, b) => a.localeCompare(b)),
    categories: Array.from(categories).sort((a, b) => a.localeCompare(b)),
  }
}

export function applyPriceFilters(
  quotes: PriceQuote[],
  filters: ParsedPriceFilters,
): PriceComparison[] {
  return summarizePriceQuotes(filterPriceQuotes(quotes, filters))
}

const getActiveOffers = cache(async function getActiveOffers() {
  const rows: OfferWithBusiness[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(`*, ${PRICE_QUOTE_EMBED}, ${BUSINESS_JOIN}`)
      .eq('is_active', true)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const page = (data ?? []) as OfferWithBusiness[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
})

export const getPublicPriceQuotes = cache(
  async function getPublicPriceQuotes() {
    return (await getActiveOffers()).flatMap(normalizeOfferItemsToQuotes)
  },
)

const getFreshOffers = cache(async function getFreshOffers() {
  const since = new Date(
    Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString()
  const rows: OfferWithBusiness[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('promo_offer_master')
      .select(`*, ${OFFER_EMBED}, ${BUSINESS_JOIN}`)
      .eq('is_active', true)
      .gte('created_at', since)
      .range(from, from + PAGE_SIZE - 1)

    if (error) throw error
    const page = (data ?? []) as OfferWithBusiness[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  return rows
})

export const getPublicPromotions = cache(async function getPublicPromotions() {
  return (await getFreshOffers())
    .map((offer) => ({ ...offer, discountSignal: promotionSignal(offer) }))
    .filter((offer): offer is PublicPromotion => offer.discountSignal !== null)
    .sort((a, b) => {
      const aDiscount = positive(a.regular_price) - positive(a.discount_price)
      const bDiscount = positive(b.regular_price) - positive(b.discount_price)
      return (
        bDiscount - aDiscount ||
        String(b.created_at).localeCompare(String(a.created_at))
      )
    })
})

export const getPublicRegularPrices = cache(
  async function getPublicRegularPrices() {
    const rows: ClinicServiceWithBusiness[] = []

    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('clinic_services')
        .select(
          `service_id, business_id, regular_price, service_category, unit_type, service_name, ${SERVICE_BUSINESS_JOIN}`,
        )
        .gt('regular_price', 0)
        .range(from, from + PAGE_SIZE - 1)

      if (error) throw error
      const page = (data ?? []) as ClinicServiceWithBusiness[]
      rows.push(...page)
      if (page.length < PAGE_SIZE) break
    }

    return rows
  },
)

export const getPublicBusinesses = cache(async function getPublicBusinesses() {
  const { data, error } = await supabase
    .from('master_business_info')
    .select(
      'business_id, name, address, city, website, review_count, score, category, facebook_url, instagram_url, created_at, updated_at',
    )
    .order('score', { ascending: false, nullsFirst: false })

  if (error) throw error
  return data ?? []
})

export const getPublicBusiness = cache(async function getPublicBusiness(
  id: number,
) {
  const [businesses, offers] = await Promise.all([
    getPublicBusinesses(),
    getFreshOffers(),
  ])
  const business =
    businesses.find((candidate) => candidate.business_id === id) ?? null
  if (!business) return null
  const businessOffers = offers.filter((offer) => offer.business_id === id)
  return {
    business,
    promotions: businessOffers
      .map((offer) => ({ ...offer, discountSignal: promotionSignal(offer) }))
      .filter(
        (offer): offer is PublicPromotion => offer.discountSignal !== null,
      ),
    regularPrices: businessOffers.filter(isRegularPrice),
  }
})

export function getFreshnessLabel(
  createdAt: string | null | undefined,
): string {
  if (!createdAt) return 'Verification pending'
  return `Updated ${new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(createdAt))}`
}

export function isMarketplaceFreshnessError(error: unknown): boolean {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    return (error as { code?: unknown }).code === '42703'
  }
  const message = error instanceof Error ? error.message : String(error)
  return message.includes('is_active') || message.includes('PGRST')
}
