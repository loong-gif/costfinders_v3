import { cache } from 'react'
import { logSupabaseError } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type {
  ClinicMembership,
  ClinicPromotion,
  ClinicService,
  Offer,
  OfferBusiness,
  OfferView,
} from '@/types/supabase'
import {
  dealPricing,
  isBlanketWording,
  offerToAnonymousDeal,
  priceIsStated,
  statedRegularPrice,
} from './adapters'

const TABLE = 'promo_offer_master'

/**
 * The public catalogue: every consumer read goes here, never to the tables.
 *
 * A database view (supabase/migrations/20260924050001_public_catalogue_views.sql): one row per
 * active offer, with the clinic's name, website and named doctors scrubbed out of its text in SQL
 * (the same rules as scrubProviderIdentity in src/lib/utils/identity.ts), its plan name withheld
 * where it names the clinic, and every source_url null. Its jsonb columns have exactly the shape
 * of OFFER_GRAPH_JOIN's embeds, so flattenOffer() reads either, and master_business_info carries
 * business_id and city only. Since 20260924050002 anon cannot read the tables at all, so nothing
 * a visitor's key can reach names the clinic behind a deal; the TS scrub in
 * offerToAnonymousDeal() is a no-op on these rows (no name to strip) apart from named doctors.
 *
 * Business identity is revealed through getBusinessRevealAction() in src/lib/actions/claims.ts
 * after a claim, not through the browse path.
 */
export const PUBLIC_OFFERS = 'public_offers'

/**
 * Adds business identity for authenticated internal surfaces (admin moderation),
 * which legitimately need to show which business submitted a deal.
 */
const BUSINESS_JOIN_WITH_IDENTITY =
  'master_business_info(business_id, name, address, city, score, review_count, category, website)'

/**
 * The normalized offer graph, as one PostgREST embed. For the admin and owner reads of the tables
 * (their RLS policies); consumer reads use PUBLIC_OFFERS, which carries the same shape.
 *
 * `promo_offer_master` lost 22 columns to normalization. Everything the app reads off an offer
 * beyond price now lives here:
 *
 *   promo_offer_items  → item_name (the title), delivered_units, unit_price
 *     └ clinic_services→ service_category, unit_type, service_area, source_url
 *   clinic_promotions  → campaign_start_date / campaign_end_date (validity), promotion_title
 *   clinic_memberships → membership_name / price / billing_period
 *
 * Both to-one embeds resolve as LEFT joins, which is load-bearing: 373 of 1000 offers have no
 * promotion_id at all, and an inner join would silently drop 240 live offers — a 35% inventory
 * loss that renders as a working page.
 *
 * `clinic_services.service_name` is NOT selected. `promo_offer_items.item_name` is a lossless,
 * strictly wider copy of it (0 divergences across 1087 rows, and populated on the 155 items
 * that have no service_id at all), so joining clinic_services for a name costs a join and
 * loses 150 offers.
 */
export const OFFER_GRAPH_JOIN = `promo_offer_items(offer_item_id, item_name, delivered_units, unit_price, clinic_services(service_category, unit_type, service_area, source_url)), clinic_promotions(promotion_title, campaign_start_date, campaign_end_date, source_url), clinic_memberships(membership_name, membership_price, billing_period, minimum_commitment_months)`

/** The raw shape PostgREST returns for OFFER_GRAPH_JOIN, before flattenOffer(). */
export interface OfferJoinedRow extends Offer {
  master_business_info: OfferBusiness | null
  promo_offer_items:
    | {
        offer_item_id: number
        item_name: string | null
        delivered_units: number | null
        unit_price: number | null
        clinic_services: Pick<
          ClinicService,
          'service_category' | 'unit_type' | 'service_area' | 'source_url'
        > | null
      }[]
    | null
  clinic_promotions: Pick<
    ClinicPromotion,
    | 'promotion_title'
    | 'campaign_start_date'
    | 'campaign_end_date'
    | 'source_url'
  > | null
  clinic_memberships: Pick<
    ClinicMembership,
    | 'membership_name'
    | 'membership_price'
    | 'billing_period'
    | 'minimum_commitment_months'
  > | null
}

/**
 * Resolve one offer's joined graph into the flat shape the app reads.
 *
 * Two canonical rules, both measured rather than assumed:
 *
 * - **Title** is `item_name` of the lowest `offer_item_id` (999/1000), falling back to
 *   `offer_raw_text` (1000/1000).
 * - **Category** is the `service_category` of the lowest `offer_item_id` whose service
 *   resolves a non-null one. 849/1000 resolve; 151 are genuinely uncategorized. 93.8% of
 *   categorized offers resolve exactly one category, so one-category-per-offer is correct.
 *   **Unless the offer is clinic-wide** (isBlanketWording in adapters.ts, blanketOfferIds() over a
 *   clinic's whole set): then it is null, which means no badge and no treatment page.
 *
 * There is no primary/headline column on `promo_offer_items` — ascending `offer_item_id` is the
 * only deterministic order, and it is the order the extractor wrote the source text in.
 *
 * Everything else service-derived (unit_type, service_area, source_url, delivered_units,
 * unit_price)
 * comes from that same category-bearing item, so an offer's unit can never contradict its
 * category. It falls back to the title item when nothing resolves a category.
 */
export function flattenOffer(row: OfferJoinedRow): OfferView {
  const { promo_offer_items, clinic_promotions, clinic_memberships, ...offer } =
    row

  const items = [...(promo_offer_items ?? [])].sort(
    (a, b) => a.offer_item_id - b.offer_item_id,
  )
  const titleItem = items[0] ?? null
  const representative =
    items.find((item) => item.clinic_services?.service_category != null) ??
    titleItem
  const service = representative?.clinic_services ?? null

  return {
    ...offer,
    service_name: titleItem?.item_name ?? offer.offer_raw_text,
    service_category: isBlanketWording(offer.offer_raw_text)
      ? null
      : (service?.service_category ?? null),
    unit_type: service?.unit_type ?? null,
    item_count: items.length,
    service_area: service?.service_area ?? null,
    source_url: service?.source_url ?? clinic_promotions?.source_url ?? null,
    delivered_units: representative?.delivered_units ?? null,
    unit_price: representative?.unit_price ?? null,
    start_date: clinic_promotions?.campaign_start_date ?? null,
    end_date: clinic_promotions?.campaign_end_date ?? null,
    promotion_title: clinic_promotions?.promotion_title ?? null,
    membership_name: clinic_memberships?.membership_name ?? null,
    membership_price: clinic_memberships?.membership_price ?? null,
    billing_period: clinic_memberships?.billing_period ?? null,
    minimum_commitment_months:
      clinic_memberships?.minimum_commitment_months ?? null,
  }
}

/** A clinic-wide discount fans out into at least this many rows… */
const FAN_OUT_MIN_ROWS = 3
/** …across at least this many categories. Four Botox/Dysport/Xeomin rows at "20% off" are a
 * neurotoxin offer; "10% off" on Botox, HydraFacial and IV therapy is not a treatment offer. */
const FAN_OUT_MIN_CATEGORIES = 2

/**
 * Offers that are ONE clinic-wide discount copied once per service. `offers` must hold every
 * visible offer of each business in it — a city's set, a business's set or the whole corpus —
 * or a fan-out split across the missing rows goes unseen.
 *
 * The pipeline rewrites each copy to name its service ("PCH Special Offer: 10% off <Halo Laser>
 * treatment plus consultation", 31 rows; "New patient: 20% off first <Botox> treatment", 20),
 * so no wording rule can see them. What gives them away is the set: same business, same stated
 * discount and no price, the same text once the title is taken out, three or more rows over two
 * or more categories. 78 live rows on 2026-09-23 beyond the 34 isBlanketWording() catches.
 * ponytail: a heuristic on sibling rows. A real per-service membership list with identical
 * wording across categories is uncategorised too — it stays on the city page, only its badge
 * and treatment pages go. The fix at the source is one unlinked row per blanket offer.
 */
export function blanketOfferIds(offers: OfferView[]): Set<number> {
  const groups = new Map<string, OfferView[]>()
  for (const offer of offers) {
    const pct = offer.discount_percent ?? 0
    const amount = offer.discount_amount ?? 0
    if (offer.business_id == null || (offer.discount_price ?? 0) > 0) continue
    if (!(pct > 0 || amount > 0)) continue
    const text = (offer.offer_raw_text ?? '').toLowerCase()
    const title = (offer.service_name ?? '').trim().toLowerCase()
    const template = title ? text.replaceAll(title, '<svc>') : text
    const key = `${offer.business_id}|${pct}|${amount}|${template}`
    const group = groups.get(key)
    if (group) group.push(offer)
    else groups.set(key, [offer])
  }
  const ids = new Set<number>()
  for (const group of groups.values()) {
    const categories = new Set(
      group.map((o) => o.service_category).filter((c) => c != null),
    )
    if (
      group.length >= FAN_OUT_MIN_ROWS &&
      categories.size >= FAN_OUT_MIN_CATEGORIES
    ) {
      for (const offer of group) ids.add(offer.id)
    }
  }
  return ids
}

/**
 * The consumer view of a business-complete set: clinic-wide offers lose their category, and
 * cards a shopper cannot tell apart collapse to one.
 *
 * "Apart" is what the card prints: same business, title, price label and wording. 9 groups on
 * 2026-09-23, mostly one rate listed under two membership tiers the card does not name. The kept
 * card is the one with the cheapest membership, then the lowest id; the others are not listed,
 * counted or declared, so their pages 404 like any delisted deal's.
 *
 * Cheapest membership, because the card's rate is reachable through that plan too: once plan
 * names left the offer wording (20260928010005), business 2528's "$11 per unit for members" kept
 * the $249/month plan's row and hid the $59/month one.
 */
function forShoppers(offers: OfferView[]): OfferView[] {
  const blanket = blanketOfferIds(offers)
  const resolved = offers.map((offer) =>
    blanket.has(offer.id) ? { ...offer, service_category: null } : offer,
  )
  const keptByCard = new Map<string, OfferView>()
  for (const offer of resolved) {
    const card = [
      offer.business_id,
      offer.service_name?.trim().toLowerCase(),
      dealPricing(offerToAnonymousDeal(offer)).text,
      (offer.offer_raw_text ?? '').replace(/\s+/g, ' ').trim().toLowerCase(),
    ].join('|')
    const kept = keptByCard.get(card)
    if (kept === undefined || keepsOver(offer, kept))
      keptByCard.set(card, offer)
  }
  const kept = new Set([...keptByCard.values()].map((offer) => offer.id))
  return resolved.filter((offer) => kept.has(offer.id))
}

const PERIODS_PER_YEAR: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  annual: 1,
  one_time: 1,
}

/**
 * Should `a` be the card shown instead of `b`? The cheaper membership a year, then the lower id.
 * ponytail: annualised fee only — a minimum commitment or a one-time fee is not weighed. A plan
 * with no published fee or period sorts after any plan that has one.
 */
export function keepsOver(a: OfferView, b: OfferView): boolean {
  const yearly = (o: OfferView) =>
    o.membership_price != null && o.billing_period
      ? o.membership_price * (PERIODS_PER_YEAR[o.billing_period] ?? 1)
      : Number.POSITIVE_INFINITY
  const ya = yearly(a)
  const yb = yearly(b)
  return ya !== yb ? ya < yb : a.id < b.id
}

/** Today as `YYYY-MM-DD`, comparable lexicographically against a Postgres `date`. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * May a signed-out visitor see this offer? The single gate for every consumer read.
 *
 * Consumer browse never filtered `is_active` before, so 322 delisted offers were served as
 * live deals. Three rules this must not get wrong:
 *
 * 1. A NULL `end_date` means VISIBLE. 896 of 1000 offers can resolve no expiry at all, so
 *    treating absence as expired would empty the site.
 * 2. `clinic_promotions.is_active` is NOT read. It is a cached restatement of the campaign
 *    date, and `promo_offer_master.is_active` is never more permissive than it (0 rows have
 *    the offer on while the promotion is off), so it adds nothing — while an active campaign
 *    must never resurrect an offer its provider deliberately delisted.
 * 3. There is no moderation clause any more, and its absence is the whole reason the owner
 *    INSERT path now forces `is_active = false`. This function used to require
 *    `moderation_status = 'approved'`, because `is_active` defaults to TRUE and an
 *    owner-submitted deal would otherwise go live the instant it was inserted. The pipeline
 *    dropped `moderation_status` and `moderation_notes` on 2026-09-15
 *    (`drop_promo_offer_moderation_columns`) and took the clause out of the RLS SELECT policy
 *    too — `Public can read active approved offers` is now `USING (is_active = true)`, a name
 *    that no longer describes what it does. `is_active` is therefore the only publication
 *    switch left, so review happens by holding a deal inactive:
 *    `20260916_owner_deals_start_inactive.sql` forces it on insert, and the admin screens
 *    publish by setting it true. Do not re-add a moderation clause here without re-adding the
 *    column — a filter on a field PostgREST does not return is a filter that always fails.
 */
export function isPubliclyVisible(
  offer: Pick<OfferView, 'is_active' | 'end_date'>,
): boolean {
  if (offer.is_active !== true) return false
  if (!offer.end_date) return true
  return offer.end_date >= todayIso()
}

/**
 * The columns a caller needs to resolve nothing but an offer's title.
 *
 * Three server actions had a hard 42703 on `select('service_name')` — that one dead column
 * blocked every consumer deal claim, the conversation list and both moderation notifications.
 * They need a title, not the whole graph, so they select this and call resolveOfferTitle().
 */
export const OFFER_TITLE_SELECT =
  'offer_raw_text, promo_offer_items(offer_item_id, item_name)'

/**
 * An offer's display title from OFFER_TITLE_SELECT, or from PUBLIC_OFFERS' `offer_raw_text,
 * promo_offer_items` (same shape). Same rule as flattenOffer().
 *
 * OFFER_TITLE_SELECT reads the tables, so it answers only admins and the offer's own approved
 * owner (20260909190003, 20260918010001), on a client carrying their session. Anyone else reads
 * PUBLIC_OFFERS, which holds active offers only.
 */
export function resolveOfferTitle(row: {
  offer_raw_text: string | null
  promo_offer_items:
    | { offer_item_id: number; item_name: string | null }[]
    | null
}): string | null {
  const lowest = (row.promo_offer_items ?? []).reduce<{
    offer_item_id: number
    item_name: string | null
  } | null>(
    (best, item) =>
      !best || item.offer_item_id < best.offer_item_id ? item : best,
    null,
  )
  return lowest?.item_name ?? row.offer_raw_text
}

export interface OfferFilters {
  city?: string
  /**
   * One DB service_category, or the several that share a browse slug. A browse bucket maps
   * to many DB values (see getDbCategoriesFromSlug), so passing a single string where the
   * caller meant a bucket silently drops the rest of it.
   */
  serviceCategory?: string | string[]
  limit?: number
}

export const getOfferById = cache(async function getOfferById(
  id: number,
): Promise<OfferView | null> {
  const { data, error } = await supabase
    .from(PUBLIC_OFFERS)
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    logSupabaseError('getOfferById', error, { dealId: id })
    if (error.code === 'PGRST116') return null
    throw error
  }
  // Active offers only (the view), but not gated on the campaign end date: the consumer wrappers
  // (getDealById / getDealWithBusinessId in unified.ts) apply isPubliclyVisible().
  return flattenOffer(data as unknown as OfferJoinedRow)
})

/**
 * The consumer corpus: every publicly visible offer, with clinic-wide offers uncategorised and
 * indistinguishable cards collapsed (see forShoppers). React-cached per request, so the counts,
 * listings and sitemap on one request read one set and cannot disagree with each other.
 */
const getAllOffersWithBusinesses = cache(
  async function getAllOffersWithBusinesses(): Promise<OfferView[]> {
    return rankBySavings(forShoppers(await _getOffers()))
  },
)

/**
 * One city's offers, filtered on the business's city rather than out of the corpus: a city is
 * every offer of its businesses, so forShoppers() sees each clinic's whole set, and a city page
 * pays for a city's rows rather than the whole corpus. `.ilike` without wildcards is a
 * case-insensitive equality, which is how the city slug has always resolved.
 */
const getCityOffers = cache(async function getCityOffers(
  city: string,
): Promise<OfferView[]> {
  return rankBySavings(forShoppers(await _getOffers(false, supabase, city)))
})

/**
 * Consumer offers, optionally narrowed to a city and/or treatment categories.
 *
 * A category is filtered in JS on the RESOLVED category, never in SQL on "any item in the
 * category": flattenOffer() names one category per offer, and a clinic-wide offer names none,
 * so a card can never appear on a treatment page its own badge disagrees with — and every count
 * taken from the same set agrees with the page it describes.
 */
export async function getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferView[]> {
  // A bare limit is the customer dashboard's "deals for you", which runs in the BROWSER: it must
  // not pull the whole corpus to show four cards. Over-fetch a ranked window instead.
  // ponytail: the window is not business-complete, so a clinic-wide offer split across it can
  // keep a badge here. Four dashboard cards; the listings never take this path.
  if (filters?.limit && !filters.city && !filters.serviceCategory) {
    const window = await _getOffers(
      false,
      supabase,
      undefined,
      filters.limit * 20,
    )
    return rankBySavings(forShoppers(window)).slice(0, filters.limit)
  }
  const offers = filters?.city
    ? await getCityOffers(filters.city)
    : await getAllOffersWithBusinesses()
  const wanted = filters?.serviceCategory
    ? new Set<string>([filters.serviceCategory].flat())
    : null
  const filtered = wanted
    ? offers.filter(
        (offer) =>
          offer.service_category != null && wanted.has(offer.service_category),
      )
    : offers
  return filters?.limit ? filtered.slice(0, filters.limit) : filtered
}

/**
 * Offers joined with business identity, for authenticated internal surfaces only
 * (admin deal moderation needs to show which business submitted a deal).
 * Never call this from a consumer-facing path — use getOffersWithBusinesses().
 *
 * `client` is REQUIRED and must carry the caller's session — pass
 * `await createSupabaseServerClient()` (src/lib/supabase-server.ts), never the anon singleton.
 * This is not a style preference. This function deliberately skips the `is_active` filter so a
 * moderator can see the 214 delisted-but-priced offers, but `promo_offer_items`' anon SELECT
 * policy gates on the parent offer being active — so read through the anon client and every one
 * of those 214 came back with an EMPTY item array. RLS returns empty results rather than errors,
 * so nothing failed loudly: flattenOffer() resolved service_name to null (falling back to the
 * entire scraped paragraph as the card title) and service_category to null, which
 * dbCategoryToTreatment() maps to 'body'. The queue rendered 214 identical "Body" cards titled
 * with prose. The admin read policy that fixes the other half is
 * supabase/migrations/20260909190003_admin_read_offer_items_and_price_history.sql, and it tests
 * `is_admin()` — which can only pass on a request that actually carries the admin's session.
 */
export async function getOffersWithBusinessIdentity(
  client: typeof supabase,
): Promise<OfferView[]> {
  return rankBySavings(await _getOffers(true, client))
}

/** PostgREST's default max-rows. A short page means the result set is exhausted. */
const PAGE_SIZE = 1000

/**
 * Deals with a saving first, then priced, then the rest. Server order only — the grids sort
 * client-side. A price or a regular price the offer's text does not state ranks as none (see
 * priceIsStated and statedRegularPrice): neither is shown, so neither is a saving.
 */
function rankBySavings(offers: OfferView[]): OfferView[] {
  const score = (o: OfferView) => {
    const price = priceIsStated(o) ? (o.discount_price ?? 0) : 0
    if (price > 0 && price < statedRegularPrice(o)) return 0
    return price > 0 ? 1 : 2
  }
  return offers.sort((a, b) => score(a) - score(b))
}

async function _getOffers(
  includeIdentity = false,
  // Consumer paths read PUBLIC_OFFERS as anon. Only the admin identity path reads the tables, on
  // a client carrying the admin's session — see getOffersWithBusinessIdentity().
  db: typeof supabase = supabase,
  /** One city, matched case-insensitively on the business's city. */
  city?: string,
  /** Fetch at most this many rows, in one request, instead of paging through all of them. */
  max?: number,
): Promise<OfferView[]> {
  let query = includeIdentity
    ? db
        .from(TABLE)
        .select(`*, ${BUSINESS_JOIN_WITH_IDENTITY}, ${OFFER_GRAPH_JOIN}`)
    : db.from(PUBLIC_OFFERS).select('*')

  // BOTH filters below are consumer-browse rules, and neither may reach the identity path —
  // the admin moderation queue, which exists to see what a shopper must not.
  //
  // `is_active` is redundant on PUBLIC_OFFERS (the view holds active offers only) and kept as a
  // statement of intent: isPubliclyVisible() below is the authoritative gate.
  //
  // The pricing `.or()` used to sit ABOVE this branch, unconditionally, and that made an
  // unpriced deal unreviewable forever. createDealAction writes regular_price /
  // discount_price only when the owner filled them in (src/lib/actions/deal-management.ts),
  // the row lands inactive, isPubliclyVisible() keeps it off the public site because it is
  // unpublished — and this filter kept it off the one screen that could publish it. Stuck in both directions, with the owner's dashboard reading "Under
  // Review" indefinitely and no screen anywhere listing it. 424 rows are in that blind spot
  // today. "Hide deals with no pricing data" is a rule about what a shopper should be shown;
  // a deal awaiting moderation must be reviewable whether or not it carries a price, and a
  // missing price is itself a reason for a moderator to reject it.
  // A STATED DISCOUNT IS PRICING DATA. This `.or()` used to read
  // `discount_price.gt.0,regular_price.gt.0`, and that hid 302 of the 814 publicly visible offers
  // (37% of live inventory) from consumer browse entirely — measured 2026-09-16. Not one of those
  // 302 was actually missing pricing: 161 state a percentage off, 144 state a dollar amount off,
  // and **zero** have neither. The rule meant "do not show a shopper a card with no price
  // information"; what it implemented was "only a base or discounted price counts as price
  // information", which is false for the way this industry advertises. A clinic that never publishes
  // a list price and runs "20% off Botox" was simply absent from the site.
  //
  // It was invisible because it presented as thin data rather than as a bug: /pennsylvania/pittsburgh
  // said "9 Active Deals" over a city with 22, since the count and the listing shared this filter and
  // therefore agreed with each other while both disagreed with the database.
  //
  // The last two terms keep the guard meaningful rather than deleting it — an offer with no price
  // AND no discount has nothing to put on a card and is still excluded. There are 0 today.
  // How each of these shapes renders is dealPricing()'s job (src/lib/data/adapters.ts).
  if (!includeIdentity) {
    query = query
      .eq('is_active', true)
      .or(
        'discount_price.gt.0,regular_price.gt.0,discount_percent.gt.0,discount_amount.gt.0',
      )
  }
  if (city) query = query.ilike('business_city', city)

  // PostgREST silently caps an unranged select at its max-rows setting (1000 here). The sitemap
  // relied on this call for its whole corpus and shipped 1000 of 1846 deal URLs — along with the
  // city and treatment/city sections, which are derived from the same array, so entire landing
  // pages went undeclared. Page until a short page comes back; ordering by id keeps the windows
  // disjoint.
  const rows: OfferJoinedRow[] = []
  const ordered = query.order('id', { ascending: true })
  if (max) {
    const { data, error } = await ordered.limit(Math.min(max, PAGE_SIZE))
    if (error) {
      logSupabaseError('getOffersWithBusinesses', error)
      throw error
    }
    rows.push(...((data ?? []) as unknown as OfferJoinedRow[]))
  }
  for (let from = 0; !max; from += PAGE_SIZE) {
    const { data, error } = await ordered.range(from, from + PAGE_SIZE - 1)
    if (error) {
      logSupabaseError('getOffersWithBusinesses', error)
      throw error
    }
    const page = (data ?? []) as unknown as OfferJoinedRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
  }

  const results = rows.map(flattenOffer)
  return includeIdentity ? results : results.filter(isPubliclyVisible)
}

/**
 * offer id → when its clinic confirmed the deal reads correctly: the public_offer_confirmations
 * view (20260928010002), which already drops a confirmation once the deal's prices or wording
 * change, a correction follows, an admin dismisses it or the deal comes down. It exposes an offer
 * id and a timestamp only, and anon reads it like PUBLIC_OFFERS. React-cached, so a page load
 * pays one query however many deal lists it builds.
 *
 * A failed read is logged and treated as no confirmations: a missing badge is true of almost
 * every deal, while a thrown error would take the deal page down with it.
 *
 * ponytail: the whole view in one request (0 rows on 2026-09-28; at most one per confirmed active
 * offer). PostgREST caps it at 1000 rows; pass the page's ids through `.in('offer_id', …)` if
 * confirmations ever approach that.
 */
export const getClinicConfirmations = cache(
  async function getClinicConfirmations(): Promise<Map<number, string>> {
    const { data, error } = await supabase
      .from('public_offer_confirmations')
      .select('offer_id, confirmed_at')
    if (error) {
      logSupabaseError('getClinicConfirmations', error)
      return new Map()
    }
    const confirmed = new Map<number, string>()
    for (const row of data ?? []) {
      if (row.offer_id != null && row.confirmed_at) {
        confirmed.set(Number(row.offer_id), String(row.confirmed_at))
      }
    }
    return confirmed
  },
)

export const getOffersByBusiness = cache(async function getOffersByBusiness(
  businessId: number,
): Promise<OfferView[]> {
  const { data, error } = await supabase
    .from(PUBLIC_OFFERS)
    .select('*')
    .eq('business_id', businessId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) {
    logSupabaseError('getOffersByBusiness', error, { businessId })
    throw error
  }
  // Consumer path (the deal page's badge — see getDealWithBusinessId), so
  // the visibility gate and the shopper view apply. A business reading its OWN deals goes
  // through getDealsForBusinessAction, which does neither.
  return forShoppers(
    (data as unknown as OfferJoinedRow[])
      .map(flattenOffer)
      .filter(isPubliclyVisible),
  )
})

export const getFeaturedOffers = cache(async function getFeaturedOffers(
  limit = 6,
): Promise<OfferView[]> {
  const { data, error } = await supabase
    .from(PUBLIC_OFFERS)
    .select('*')
    .eq('is_active', true)
    // Both > 0, which also excludes NULL: a saving needs both prices. ("100% off" rows carry
    // discount_price = 0 and once filled 16 of 24 slots of the old over-fetch window.)
    .gt('discount_price', 0)
    .gt('regular_price', 0)
    // No over-fetch limit: which rows show a saving is decided after the fetch (a regular price
    // the text never states shows none — 114 of 292 on 2026-09-28), and a window ranked on the
    // pipeline's discount_percent could come back empty, which /api/health reads as an outage.
    // ponytail: a few hundred rows; PostgREST caps the select at 1000.
    .order('id')

  if (error) {
    logSupabaseError('getFeaturedOffers', error)
    throw error
  }

  // Biggest saving as a PERCENT of the regular price, from the two prices the card shows — not
  // dollars off. The two prices share a basis (both per unit on a rate, both totals on a
  // package), so their ratio compares across bases where their difference cannot: dollars ranked
  // a $1,499 bundle's $626 above a $2.50-a-unit saving that is proportionally larger. A price or
  // a regular price the offer's text never states is not shown (priceIsStated,
  // statedRegularPrice), so it cannot make one of the biggest savings either.
  const ranked = (data as unknown as OfferJoinedRow[])
    .map(flattenOffer)
    .filter(isPubliclyVisible)
    .map((offer) => ({ offer, deal: offerToAnonymousDeal(offer) }))
    .filter(
      ({ deal }) => deal.originalPrice > deal.dealPrice && deal.dealPrice > 0,
    )
  const saving = ({ deal }: (typeof ranked)[number]) =>
    1 - deal.dealPrice / deal.originalPrice
  return ranked
    .sort((a, b) => saving(b) - saving(a))
    .slice(0, limit)
    .map(({ offer }) => offer)
})
