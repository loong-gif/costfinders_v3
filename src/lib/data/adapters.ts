import { scrubProviderIdentity } from '@/lib/utils/identity'
import type {
  AnonymousDeal,
  ComparablePrice,
  DealInterpretation,
  InterpretationNote,
  InterpretationReason,
  LeanOffer,
  MembershipTerms,
  PriceBasis,
  TreatmentCategory,
} from '@/types/deal'
import type {
  ClinicServiceCategory,
  OfferView,
  PublicBusiness,
} from '@/types/supabase'
import { Constants } from '@/types/supabase.generated'

/**
 * Every US state code → its name. Reference data, not a curated subset: a partial list is how the
 * city map below started, and the moment the pipeline ingested a city outside it, that city's page
 * stopped being generated with no error anywhere.
 */
export const US_STATE_NAMES: Record<string, string> = {
  AL: 'Alabama',
  AK: 'Alaska',
  AZ: 'Arizona',
  AR: 'Arkansas',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DC: 'District of Columbia',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
}

/**
 * The state written in the business's own address, or null.
 *
 * `master_business_info` has no `state` column, but 391 of its 419 addresses end in
 * `", XX 12345"` — measured 2026-09-16, with zero rows carrying that pattern anywhere other than
 * the end, which is why the regex is end-anchored rather than greedy. This is strictly better than
 * the city map below for two reasons: it needs no maintenance, and it is per-business rather than
 * per-city-name.
 *
 * Per-business matters. "Lake Forest" exists in this dataset in BOTH California (3 businesses) and
 * Illinois (1), so a city → state map cannot be right for all four rows no matter what it says.
 * CITY_STATE_MAP calls it California, and the Illinois clinic's provider page therefore claimed to
 * be in California. Reading the address fixes that row and every future collision like it.
 */
export function stateFromAddress(
  address: string | null | undefined,
): { state: string; stateCode: string } | null {
  if (!address) return null
  const match = address.match(/,\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\s*$/)
  if (!match) return null
  const stateCode = match[1]
  const state = US_STATE_NAMES[stateCode]
  // A two-letter run that is not a real state code is a street abbreviation, not a state.
  if (!state) return null
  return { state, stateCode }
}

/**
 * City → State fallback for the 28 businesses whose address does not end in a state and zip.
 *
 * Kept, not deleted: all 28 are in cities already listed here (Irvine 17, Tustin 5, Costa Mesa 2,
 * Lake Forest 1, Santa Ana 1, Laguna Beach 1, plus one row with no city at all), so this is what
 * takes coverage of cities-with-visible-deals from 97% to 100%. It is now a fallback rather than
 * the primary source, so a city missing from it no longer means a missing page — see
 * tests/unit/cityStateCoverage.test.ts, which fails the gate if any city with visible deals resolves no
 * state by either route.
 */
const CITY_STATE_MAP: Record<string, { state: string; stateCode: string }> = {
  // Arizona
  tucson: { state: 'Arizona', stateCode: 'AZ' },
  'oro valley': { state: 'Arizona', stateCode: 'AZ' },
  // California
  irvine: { state: 'California', stateCode: 'CA' },
  tustin: { state: 'California', stateCode: 'CA' },
  'costa mesa': { state: 'California', stateCode: 'CA' },
  'santa ana': { state: 'California', stateCode: 'CA' },
  'laguna hills': { state: 'California', stateCode: 'CA' },
  'laguna niguel': { state: 'California', stateCode: 'CA' },
  'laguna beach': { state: 'California', stateCode: 'CA' },
  'newport beach': { state: 'California', stateCode: 'CA' },
  'lake forest': { state: 'California', stateCode: 'CA' },
  'mission viejo': { state: 'California', stateCode: 'CA' },
  'foothill ranch': { state: 'California', stateCode: 'CA' },
  pasadena: { state: 'California', stateCode: 'CA' },
  // San Fernando Valley / Conejo. Absent until now, which stranded Woodland Hills —
  // the third-largest market in the data, 35 businesses — with no state, and so no
  // city page, no sitemap entry and no eligible pricing guide.
  'woodland hills': { state: 'California', stateCode: 'CA' },
  calabasas: { state: 'California', stateCode: 'CA' },
  'canoga park': { state: 'California', stateCode: 'CA' },
  'west hills': { state: 'California', stateCode: 'CA' },
  // Colorado
  boulder: { state: 'Colorado', stateCode: 'CO' },
  louisville: { state: 'Colorado', stateCode: 'CO' },
  superior: { state: 'Colorado', stateCode: 'CO' },
  // Oklahoma
  'oklahoma city': { state: 'Oklahoma', stateCode: 'OK' },
  edmond: { state: 'Oklahoma', stateCode: 'OK' },
  norman: { state: 'Oklahoma', stateCode: 'OK' },
  yukon: { state: 'Oklahoma', stateCode: 'OK' },
  moore: { state: 'Oklahoma', stateCode: 'OK' },
  newalla: { state: 'Oklahoma', stateCode: 'OK' },
  bethany: { state: 'Oklahoma', stateCode: 'OK' },
  'midwest city': { state: 'Oklahoma', stateCode: 'OK' },
  'the village': { state: 'Oklahoma', stateCode: 'OK' },
}

/**
 * Resolve a business's state: its own address first, the city map second, empty last.
 *
 * `address` is optional so the city-level callers that genuinely have no address still compile,
 * but pass it wherever you have it — it is the only route that is right for a city name that
 * exists in two states.
 *
 * An empty stateCode is load-bearing, not a placeholder: `generateStaticParams` for
 * `/[state]/[city]` resolves it through `states.find()` and emits NO PAGE when it comes back
 * undefined. That silent no-page is what stranded 204 deals across 23 cities until 2026-09-16.
 */
export function inferState(
  city: string | null,
  address?: string | null,
): {
  state: string
  stateCode: string
} {
  const fromAddress = stateFromAddress(address)
  if (fromAddress) return fromAddress
  if (!city) return { state: '', stateCode: '' }
  const key = city.toLowerCase().trim()
  return CITY_STATE_MAP[key] ?? { state: '', stateCode: '' }
}

/**
 * Every live `clinic_services.service_category` value → the consumer treatment slug it belongs to.
 *
 * This is the ONE source of truth for the mapping; TREATMENT_TO_DB below is derived from it so
 * the two directions cannot drift apart again.
 *
 * The vocabulary has now changed WHOLESALE twice, and both times silently, because every
 * lookup here has a total fallback. The second time was 2026-09-15, when the pipeline made
 * `service_category` an enum and then restricted it
 * (`convert_clinic_service_name_category_to_enums`, `restrict_clinic_service_taxonomy`):
 * twelve values collapsed to five, and the two that are new — `Dermal Filler` (201 services)
 * and `Microneedling` (30) — were unmapped, so every filler deal on the site fell through
 * `?? 'body'` and /treatments/fillers listed nothing while the inventory was intact.
 *
 * Keep exhaustive against `select distinct service_category from clinic_services`; the enum's
 * members are the whole list (`select enum_range(null::service_category_enum)`). There is no
 * legacy set — the old vocabulary's rows do not exist, so a dead key here is not harmless
 * clutter, it is a claim about the data that is false. Do NOT add a TreatmentCategory value to
 * accommodate a new key — the six buckets each own routes, guides and sitemap entries.
 *
 * An offer with no category maps to NO treatment (null), not to a catch-all. It used to fall
 * into 'body', which badged "10% off injectables" and every IV drip "Body" (63 cards on
 * 2026-09-23). Null means no badge and no treatment page; the offer stays on its city and
 * provider listings.
 */
const DB_TO_TREATMENT: Record<ClinicServiceCategory, TreatmentCategory> = {
  // Injectables
  Neurotoxin: 'botox',
  'Dermal Filler': 'fillers',

  Facial: 'facials',

  // Microneedling → 'skincare', not 'facials'. It is skin rejuvenation rather than a facial,
  // and it is the only live category that can feed the six published skincare-cost-* guides —
  // the previous vocabulary's `Skincare` value no longer exists, so without this the
  // /deals/skincare route and those six pages could only ever be empty (the
  // categoryTaxonomy test 'every treatment bucket can actually be queried for' catches
  // exactly that). The coarser browse bucket in categories.ts puts it under
  // "Facials & Lasers", which is the nearest of the four buckets that exist there.
  Microneedling: 'skincare',

  // Added to the enum out of band on 2026-09-16, which made this map non-exhaustive and broke
  // the build — the gate working. Both buckets are the ones src/lib/data/categories.ts already
  // states in prose for the same two members: regenerative injectables (PRF, PRP, exosomes,
  // 14 services) induce the patient's own collagen rather than adding volume, so they belong
  // with Microneedling in 'skincare' and NOT beside Dermal Filler; Body Contouring (6) is a
  // device or injection applied to a named area, which is what 'body' means.
  'Regenerative Injectable': 'skincare',
  'Body Contouring': 'body',
  // Added out of band on 2026-09-19 (HIFU, Sofwave, Ultherapy, Thermage): energy devices that
  // tighten skin by inducing collagen, the same outcome as Microneedling, so the same bucket.
  'Skin Tightening': 'skincare',

  // Energy-based devices
  'Laser & Light': 'laser',
  'Laser Hair Removal': 'laser',

  // IV drips, vitamin shots, hormones, peptides, weight loss — 35 live deals on 2026-09-23 that
  // were badged "Body". Systemic, not applied to an area, so their own bucket.
  Wellness: 'wellness',
}

const TREATMENT_TO_DB = Object.entries(DB_TO_TREATMENT).reduce(
  (acc, [dbCategory, treatment]) => {
    acc[treatment].push(dbCategory)
    return acc
  },
  {
    botox: [],
    fillers: [],
    facials: [],
    laser: [],
    body: [],
    skincare: [],
    wellness: [],
  } as Record<TreatmentCategory, string[]>,
)

/**
 * The treatment an offer is labelled with, or null for one that names no single treatment.
 * Total over the enum (every member has an explicit entry, a compile error otherwise) — but no
 * longer total over offers: a null category is null, not 'body'.
 */
export function dbCategoryToTreatment(
  dbCategory: ClinicServiceCategory | null,
): TreatmentCategory | null {
  if (!dbCategory) return null
  return DB_TO_TREATMENT[dbCategory] ?? null
}

/**
 * The treatment page that can serve this offer, or null. Since null stopped meaning 'body' this
 * is the same answer as the label, by design: a card's badge and the pages it appears on can no
 * longer disagree. Kept as its own name because the question ("does a page exist") is different.
 */
export const offerTreatmentRoute = dbCategoryToTreatment

/**
 * One label per treatment, for badges, page names, search and charts alike.
 *
 * 'botox' reads "Neurotoxins": the bucket also holds Dysport, Xeomin, Jeuveau and Daxxify, and a
 * range pooled across them under the word "Botox" advertised Dysport's $3 unit as a Botox price.
 * A label may say "Botox" only over Botox-brand rows — see `neurotoxinBrand()`.
 */
export const TREATMENT_LABELS: Record<TreatmentCategory, string> = {
  botox: 'Neurotoxins',
  fillers: 'Fillers',
  facials: 'Facials',
  laser: 'Laser',
  body: 'Body contouring',
  skincare: 'Skincare',
  wellness: 'Wellness',
}

export function getTreatmentLabel(slug: TreatmentCategory): string {
  return TREATMENT_LABELS[slug] ?? slug
}

const NEUROTOXIN_BRANDS = [
  'Botox',
  'Dysport',
  'Xeomin',
  'Jeuveau',
  'Daxxify',
  'Letybo',
  'Myobloc',
]

/**
 * The neurotoxin brand an offer is for, or null when nothing names exactly one.
 *
 * The title item first ("Dysport"), then the offer's own words. A Dysport unit is roughly a
 * third of a Botox unit, so a "from $X per unit" that says Botox must be a Botox row's price.
 * ponytail: a word match. "Botox / Dysport ($11.20 Botox, $3.72 Dysport)" names two and returns
 * null, which only ever withholds a brand, never mislabels one.
 */
export function neurotoxinBrand(
  title: string | null | undefined,
  text?: string | null,
): string | null {
  const named = (s: string | null | undefined) =>
    NEUROTOXIN_BRANDS.filter((b) => new RegExp(`\\b${b}\\b`, 'i').test(s ?? ''))
  const fromTitle = named(title)
  if (fromTitle.length === 1) return fromTitle[0]
  const fromText = named(text)
  return fromText.length === 1 ? fromText[0] : null
}

/** Service and category names — a title that is one of these says what, not which deal. */
const BARE_TITLES = new Set(
  [
    ...Constants.public.Enums.clinic_service_name_enum,
    ...Constants.public.Enums.clinic_service_category_enum,
  ].map((name) => name.toLowerCase()),
)

/**
 * Offer wording shown under a bare title, trimmed at a word near this length. Only a backstop:
 * rows and tiles clamp the headline to two lines, and at 90 this cut 39 offers mid-price ("… 3
 * area treatments for the price of 2, $1,200…") beside a half-empty row. On 2026-09-28 the
 * longest of 919 was 181 characters, so the clamp does the work and the deal page's h1 is whole.
 */
const SUBTITLE_CHARS = 200

/**
 * The offer's own words, for under a title that is only a product or category name. 931 of 947
 * live cards were titled that way on 2026-09-23 ("Neurotoxin", "Botox"), so five NakedMD cards
 * read "Neurotoxin: $99" while their text said bunny lines, chin, gummy smile, jelly roll and
 * nose. Null when the title is specific, or the text adds nothing to it.
 */
export function offerSubtitle(
  title: string,
  text: string | null | undefined,
): string | null {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!clean || !BARE_TITLES.has(title.trim().toLowerCase())) return null
  if (clean.toLowerCase() === title.trim().toLowerCase()) return null
  // Sentence case only for SHOUTED text ("DYSPORT $3.15/UNIT"); anything else keeps its brand
  // capitals ("BBL", "Juvéderm").
  const cased = clean === clean.toUpperCase() ? clean.toLowerCase() : clean
  const sentence = cased.charAt(0).toUpperCase() + cased.slice(1)
  if (sentence.length <= SUBTITLE_CHARS) return sentence
  const cut = sentence.slice(0, SUBTITLE_CHARS)
  return `${cut.slice(0, cut.lastIndexOf(' ') > 60 ? cut.lastIndexOf(' ') : SUBTITLE_CHARS).trimEnd()}…`
}

/**
 * The category each treatment is named after. As a title it only restates the treatment's label
 * ("Neurotoxin" on a Neurotoxins deal). Keyed on every treatment, so a new one is a compile error
 * here. Skincare has none: all three of its categories are narrower than it.
 */
const NAMESAKE_CATEGORY: Record<
  TreatmentCategory,
  ClinicServiceCategory | null
> = {
  botox: 'Neurotoxin',
  fillers: 'Dermal Filler',
  facials: 'Facial',
  laser: 'Laser & Light',
  body: 'Body Contouring',
  skincare: null,
  wellness: 'Wellness',
}

/**
 * The small line under a row's or tile's headline, so the two can never disagree. Where the
 * offer's words lead (`subtitle`), the title goes here whenever it says more than the treatment:
 * on 2026-09-28, 297 of the 923 offers with a subtitle never repeat their title in it (Botox 24,
 * BBL Photofacial 14, Juvéderm 9, Sculptra 5), so a brand the words omit would otherwise be lost.
 * A title that only restates the treatment ("Neurotoxin"), or one that is already the headline,
 * gives way to the treatment's label. Null for a deal with neither.
 */
export function productLine(
  offer: Pick<LeanOffer, 'title' | 'subtitle' | 'treatment' | 'clinicWide'>,
): string | null {
  // "Complimentary Consultation & 10% OFF First Treatment" read "Botox" underneath: the one
  // service the pipeline linked a clinic-wide discount to. The owner's rule: no badge for it.
  if (offer.clinicWide) return null
  const label = offer.treatment && getTreatmentLabel(offer.treatment)
  if (!offer.subtitle) return label
  const title = offer.title.trim()
  const namesake = offer.treatment && NAMESAKE_CATEGORY[offer.treatment]
  return namesake && namesake.toLowerCase() === title.toLowerCase()
    ? label
    : title
}

export function treatmentToDbCategories(
  treatment: TreatmentCategory,
): string[] {
  return TREATMENT_TO_DB[treatment] ?? []
}

/**
 * The offer's terms, assembled from the two structured facts that survive.
 *
 * Free-text T&C had no carrier in the normalized schema — the old `eligibility` column is
 * gone and nothing replaces it. Rather than fabricate a sentence, this states only what the
 * booleans on `promo_offer_master` actually assert: `is_new_customer_required` (324 true) and
 * `is_membership_required` (349 true).
 *
 * The plan is never named (owner decision, 2026-09-28). A plan's name is the clinic's own
 * coinage: "Club FX" on /deals/8107 is one web search from DermFx, though it never says "DermFx".
 * public_offers withholds it too (20260928010004); a customer who claims gets it back through
 * claimed_membership_name(), in the revealed clinic card. This string is serialised into every
 * listing payload, so it must not carry the name even when a base-table read supplies one.
 */
function offerTerms(offer: OfferView): string {
  const facts: string[] = []
  if (offer.is_new_customer_required) facts.push('New customers only.')
  if (offer.is_membership_required) facts.push('Membership required.')
  return facts.join(' ')
}

const BILLING_PERIODS = ['monthly', 'annual', 'quarterly', 'one_time'] as const

/**
 * The plan behind a member price, for the deal page only — never a listing payload, which says
 * "for members" and shows no fee (owner decision, 2026-09-28). Null when the offer needs no
 * membership, or its plan states nothing (24 membership offers had no plan at all on
 * 2026-09-24); the page then says the clinic didn't publish the price. `name` is always null
 * here: the plan's name waits for a claim (see offerTerms()).
 */
export function offerMembershipTerms(offer: OfferView): MembershipTerms | null {
  if (!offer.is_membership_required) return null
  const period = BILLING_PERIODS.find((p) => p === offer.billing_period)
  const terms: MembershipTerms = {
    name: null,
    price: offer.membership_price,
    billingPeriod: period ?? null,
    minimumCommitmentMonths: offer.minimum_commitment_months,
  }
  return Object.values(terms).some((v) => v != null) ? terms : null
}

/**
 * Transform a resolved OfferView into the AnonymousDeal shape that all consumer-facing UI
 * components expect.
 *
 * Two fields deliberately resolve to '' rather than a stand-in, because each is absent for most
 * offers and a placeholder reads as a fact the data does not support:
 *
 * - `validFrom` — 68/1000. The old `?? created_at` presented the SCRAPE date as the offer's
 *   start date on every deal page.
 * - `validUntil` — 104/1000, and only 41 of 678 active offers. `pricingBreakdown` drops the
 *   whole validity row when both are '' and prints "Valid until X" when only the end resolves.
 *
 * `templateType` is gone from AnonymousDeal entirely: `promo_offer_master.template_type` has no
 * successor. `price_model` (total/per_unit/from) is the nearest surviving column but it
 * describes pricing shape, not offer archetype, so it must not be silently re-pointed here.
 */
export function offerToAnonymousDeal(offer: OfferView): AnonymousDeal {
  const biz = offer.master_business_info
  const priceBasis = offerPriceBasis(offer)
  // Either way the stored figure is not a price the clinic published, so no surface prints or
  // ranks it: dealPricing() falls back to the discount the offer states.
  const misread =
    isMisreadUnitRate(
      offer.service_category,
      priceBasis,
      offer.discount_price,
    ) || !priceIsStated(offer)
  const dealPrice = misread ? 0 : (offer.discount_price ?? 0)
  const regular = statedRegularPrice(offer)
  const { percent: storedPercent, amount: discountAmount } =
    printableDiscount(offer)

  return {
    id: String(offer.id),
    // service_name already falls back to offer_raw_text inside flattenOffer(), so this last
    // '|| ' only fires for a row with neither — which is 0 of 1000 today.
    // Both texts are the clinic's own words, so its name comes out here, once, for every
    // pre-claim surface: cards, deal page, titles, JSON-LD (scrubProviderIdentity). The name
    // only reaches this function on the server — see BUSINESS_JOIN in offers.ts.
    title: scrubProviderIdentity(offer.service_name, biz) || 'Special Offer',
    description:
      scrubProviderIdentity(offer.offer_raw_text ?? offer.service_name, biz) ||
      'Treatment',
    category: dbCategoryToTreatment(offer.service_category),
    originalPrice: regular,
    // NOT `?? offer.regular_price`. That fallback printed the price BEFORE the discount as the
    // deal price on the 23 offers that carry a regular_price and no discount_price — and since
    // originalPrice is the same number, nothing struck it through and no badge qualified, so the
    // card advertised the full price as the deal with no indication at all. It also published
    // that number to Google as the offer's price. 0 means "the clinic published no price", which
    // `dealPricing()` reads as "lead with the stated discount instead".
    dealPrice,
    // Derived only from two prices the site shows — never from a regular price it withholds.
    discountPercent:
      storedPercent ??
      (regular > dealPrice && dealPrice > 0
        ? Math.round((1 - dealPrice / regular) * 100)
        : 0),
    discountAmount,
    // Both of these exist so `dealPricing()` can soften a claim the raw numbers overstate: a
    // 100%-off membership benefit is not "Free", and a `from` price is not the price. This is
    // the one place the `price_model` vocabulary is compared to a string — the column is plain
    // text, not an enum, so a pipeline rename here fails silently rather than at compile time.
    requiresMembership: offer.is_membership_required ?? false,
    isFromPrice: offer.price_model === 'from',
    priceBasis,
    validFrom: offer.start_date ?? '',
    validUntil: offer.end_date ?? '',
    termsAndConditions: offerTerms(offer),
    // No image until deal images ship from the Supabase `deal-images` bucket, where the
    // upload action already writes (src/lib/actions/deal-images.ts, path
    // `deal-images/{businessId}/{dealId}`). This used to build a Cloudinary URL by
    // convention (`deals/{businessId}/hero`), which made dealCard's
    // `hasImage = Boolean(deal.imageUrl)` always true and fired a 404 through the Next image
    // optimizer for every card on the page — 21 of them on /deals/tucson. Resolve it from
    // the stored object when the bucket is wired up; do not guess a URL.
    imageUrl: undefined,
    isActive: offer.is_active ?? false,
    isFeatured: false,
    isSponsored: false,
    claimCount: 0,
    viewCount: 0,
    createdAt: offer.created_at,
    updatedAt: offer.updated_at ?? offer.created_at,
    locationArea: biz?.city ?? '',
    // No Google rating or review count, pre-claim (owner decision, 2026-09-24). Matched against
    // the clinics in the city's public directory — or Google Maps — "4.8 (161 reviews)" named
    // exactly one clinic on 912 of 944 rated deals; bucketed to "100+ reviews", 391; the rating
    // alone, 244. This object is serialised into the page for client components, so what is not
    // shown is not carried either. The reveal after a claim shows the full rating.
    businessTier: 'unclaimed',
    interpretation: interpretOffer(offer),
    // Filled from public_offer_confirmations by the offer layer once clinics can confirm.
    clinicConfirmedAt: null,
  }
}

/**
 * The stored percent and amount off a deal may carry. A stored percent on a row whose regular
 * price was dropped is, on the priced rows, the pipeline's own division by that regular (7792
 * "40 Units Botox $299": 37.7% of an unstated $480), so only a percent the offer's text states
 * survives there. 100% is kept: it is the pipeline's code for "free"/"included", which the text
 * words, not a division — dropping it turned 10 "Free Lunchtime Peel" rows into "$125 off", the
 * unstated regular as a discount. Likewise the stored amount: on such a row it is that regular
 * minus the price, unless the offer's own words state it. Shared by offerToAnonymousDeal() and
 * interpretOffer(), so the discount a card leads with is the one its label vouches for.
 */
function printableDiscount(offer: OfferView): {
  percent: number | null
  amount: number | undefined
} {
  const text = offer.offer_raw_text
  const regularDropped =
    (offer.regular_price ?? 0) > 0 && statedRegularPrice(offer) === 0
  const percent = offer.discount_percent
  return {
    percent:
      percent != null &&
      !(regularDropped && percent < 100 && !percentInText(percent, text))
        ? percent
        : null,
    amount:
      regularDropped && !figureInText(offer.discount_amount, text)
        ? undefined
        : (offer.discount_amount ?? undefined),
  }
}

const COUNT_WORDS = [
  'one',
  'two',
  'three',
  'four',
  'five',
  'six',
  'seven',
  'eight',
  'nine',
  'ten',
]
const COUNT = `(\\d+|${COUNT_WORDS.join('|')})`
const BUY_GET_FREE = new RegExp(
  `\\b(?:buy|purchase)\\s+${COUNT}\\b[^.;!]*?\\b(?:get|receive)\\s+${COUNT}\\s+(?:[\\w-]+\\s+){0,3}?free\\b`,
  'i',
)

/**
 * "Buy 2, get 1 free", "Buy 6 laser sessions, get 1 free", "purchase 3 treatments, receive 1
 * free": how many you pay for and how many come free, or null. The pipeline turns these into a
 * percent off that the offer never states — see interpretOffer()'s `discount-derived`.
 * ponytail: digits and one to ten in words. "Buy two, get the third free" reads as null, which
 * only withholds "Our math" (the deal is then Confirm when booking), never grants it.
 */
export function buyGetFree(
  text: string | null | undefined,
): { buy: number; free: number } | null {
  const match = BUY_GET_FREE.exec(text ?? '')
  if (!match) return null
  const count = (word: string) =>
    /^\d+$/.test(word)
      ? Number(word)
      : COUNT_WORDS.indexOf(word.toLowerCase()) + 1
  const buy = count(match[1])
  const free = count(match[2])
  return buy > 0 && free > 0 ? { buy, free } : null
}

/**
 * The regular price as the site may print it: only where the offer's own words state it, or the
 * deal is owner-typed (no items — the owner typed it into a field). Otherwise 0, so no
 * strike-through, no "Save X%", no "Regularly $X" and no list price in JSON-LD (trust item 5,
 * owner decision 2026-09-28). On 2026-09-28, 114 of the 292 visible offers carrying a regular
 * price did not state it, and 99 of them printed a saving against it — 1386's $13 is a
 * service-menu figure its "20% off Botox" text never mentions.
 */
export function statedRegularPrice(
  offer: Pick<OfferView, 'regular_price' | 'offer_raw_text' | 'item_count'>,
): number {
  const regular = offer.regular_price ?? 0
  if (!(regular > 0)) return 0
  return offer.item_count === 0 || figureInText(regular, offer.offer_raw_text)
    ? regular
    : 0
}

/** Does the offer's text state this percentage ("20%", "20 %")? Whole percents only. */
export function percentInText(
  percent: number,
  text: string | null | undefined,
): boolean {
  return new RegExp(`\\b${Math.round(percent)}\\s*%`).test(text ?? '')
}

/**
 * Units a price can be stated per or counted in. `package` is deliberately absent: it is a
 * shape, not a unit — a package's price depends on what is in it, so "per package" states a
 * per-unit cost that does not exist. `shot` arrived out of band on 2026-09-17 (two free
 * vitamin-shot services). tests/unit/guideStats.test.ts fails when the snapshot's
 * `clinic_services.unit_type` vocabulary grows a value this list does not decide.
 */
export const PRICE_UNITS = [
  'unit',
  'syringe',
  'vial',
  'session',
  'treatment',
  'area',
  'shot',
]
const PRICE_UNIT_WORDS = PRICE_UNITS.join('|')

/** The offer naming its own rate: "$12/unit", "$599 per syringe", "$10.50 a unit", "$850/vial". */
const STATED_RATE = new RegExp(
  `(?:/|\\bper\\b|\\ba\\b|\\beach\\b)\\s*(${PRICE_UNIT_WORDS})s?\\b`,
  'i',
)

/**
 * The one category whose unit is not in doubt: neurotoxins are dosed in units. Deliberately not
 * extended to fillers — "syringe" is right for most filler packages but 2 of the 9 live ones are
 * "area" treatments, and a wrong unit is a false price claim where no unit is merely a plain one.
 */
const CATEGORY_UNIT: Partial<Record<ClinicServiceCategory, string>> = {
  Neurotoxin: 'unit',
}

/**
 * What the offer's price buys — see `PriceBasis` in src/types/deal.ts.
 *
 * `price_model` says whether the clinic stated a whole-offer price or a unit price, and the
 * pipeline's own column comment says `discount_price` is always the normalized TOTAL: unit price
 * × `delivered_units`. So a `per_unit` row is a one-unit rate only while `delivered_units` is
 * unstated; with a count, it is a quantity like any other (offer 7649: "$9/unit", 50 units,
 * discount_price $450).
 *
 * The unit word comes from, in order: the service's `unit_type`, the offer's own words, the
 * category. `unit_type` is NULL on 874 of 1056 services, which is why "Sculptra $765/vial" and
 * "$599 per syringe" need the text.
 *
 * Measured on 2026-09-17 against all 497 visible priced offers, each classified from its own
 * text and re-checked: this is truthful on 453. The other 44 are rows the pipeline stored wrong
 * (13 per-unit rates saved as `total`, ~26 prices the offer text never states, quantities left at
 * the column's DEFAULT 1) — reading them "correctly" would mean overriding the data with regexes.
 *
 * ponytail: the text is read with a regex, as the "up to" hedge in dealPricing() is. A `total`
 * row is never overridden from text — "Botox: 30% off at $9.45/unit; 20 units $189" is a
 * $189 package. The real fix is a price-unit column in the pipeline; nothing records it today.
 */
export function offerPriceBasis(
  offer: Pick<
    OfferView,
    | 'price_model'
    | 'unit_type'
    | 'delivered_units'
    | 'service_category'
    | 'offer_raw_text'
    | 'item_count'
    | 'discount_price'
  >,
): PriceBasis {
  const text = offer.offer_raw_text ?? ''
  const serviceUnit =
    offer.unit_type && PRICE_UNITS.includes(offer.unit_type)
      ? offer.unit_type
      : null
  const categoryUnit = offer.service_category
    ? (CATEGORY_UNIT[offer.service_category] ?? null)
    : null
  const count = offer.delivered_units

  // `delivered_units` defaults to 1 in the database, so only a count of 2 or more is a claim.
  if (count != null && count >= 2) {
    // A bundle's representative item is one of several things the price buys: "50 Units of
    // Jeuveau, 1 Syringe of Lip Filler, 3 Hydrafacials… $1,499" is not $1,499 for 50 units.
    if (offer.item_count !== 1) return { kind: 'total' }
    const statedUnit = text
      .match(
        new RegExp(`\\b${count}\\s*-?\\s*(${PRICE_UNIT_WORDS})s?\\b`, 'i'),
      )?.[1]
      ?.toLowerCase()
    const unit = serviceUnit ?? statedUnit ?? categoryUnit
    return unit ? { kind: 'quantity', count, unit } : { kind: 'total' }
  }

  // A `from` floor can be a rate too — "New Patient tox Starts at $9 per unit" — and the column
  // cannot say both, so the text decides. `per_unit` needs no such help.
  const stated = text.match(STATED_RATE)?.[1]?.toLowerCase() ?? null
  if (
    offer.price_model === 'per_unit' ||
    (offer.price_model === 'from' && stated)
  ) {
    const unit = serviceUnit ?? stated ?? categoryUnit
    // "$11.50/equivalent dosing Dysport (regularly $13.50/unit)" — 3 rows at business 1702 on
    // 2026-09-28 — is a price per Botox-equivalent dose, not per Dysport unit (a third the size):
    // "per unit" under "Dysport" read as a Dysport rate three times what it is. Said as what it
    // is, and, not being a unit, it is neither ranked nor pooled (comparablePrice()).
    return unit === 'unit' && /\bequivalent\s+dos/i.test(text)
      ? { kind: 'rate', unit: 'Botox-equivalent unit' }
      : { kind: 'rate', unit }
  }

  // A `total` row is a rate when its own text states THAT price as one: "$10.50 a unit for
  // neurotoxins" (7930), "$8 a unit Botox unlimited" (8104), "IV nutrient drip special: $12/unit"
  // (9842, which was setting Newport Beach's "from $12"). Only at exactly the stored price — "Botox:
  // 30% off at $9.45/unit; 20 units $189" stores $189 and stays a package.
  if (offer.price_model === 'total' && offer.discount_price) {
    const rateAtPrice = text
      .match(
        new RegExp(
          `${priceInText(offer.discount_price)}\\s*(?:/|\\bper\\b|\\ba\\b|\\beach\\b)\\s*(${PRICE_UNIT_WORDS})s?\\b`,
          'i',
        ),
      )?.[1]
      ?.toLowerCase()
    if (rateAtPrice) {
      return { kind: 'rate', unit: serviceUnit ?? rateAtPrice }
    }
  }
  return { kind: 'total' }
}

/**
 * A regex source matching `price` as written in offer text: "$1,499", "$1499.00", "$10.50",
 * "$10.5", "$99." at the end of a sentence. Never inside a longer number ("$105" is not "$10.5").
 * `currencyOptional` also accepts a bare "13.5 per unit", which only a detector should — the
 * basis rule above requires the "$" before it will treat a total as a rate.
 */
export function priceInText(price: number, currencyOptional = false): string {
  const [whole, cents] = price.toFixed(2).split('.')
  const digits = Number(whole).toLocaleString('en-US').replaceAll(',', ',?')
  const fraction =
    cents === '00' ? '(?:\\.00?)?' : `\\.${cents.replace(/0$/, '')}0?`
  const currency = currencyOptional ? '\\$?' : '\\$'
  return `(?<![\\d.,])${currency}\\s*${digits}${fraction}(?!\\.?\\d)`
}

/** Is this figure written in the text, "$" optional ("13.5 per unit")? False for no figure. */
export function figureInText(
  figure: number | null | undefined,
  text: string | null | undefined,
): boolean {
  if (!figure || figure <= 0) return false
  return new RegExp(priceInText(figure, true), 'i').test(text ?? '')
}

/**
 * Does the offer's own text state its stored price? The `price-not-in-text` rule that
 * `npm run prices:check` flags, run on every render so the site never prints a price the clinic
 * did not publish: "20% off Botox for first-time patients" stored as $10.40 a unit, "10% off
 * SkinVive (regularly $450)" stored as $405. 16 live rows on 2026-09-23.
 *
 * Exempt: a total the pipeline multiplied out from a stated rate ("100 units at $12/unit" →
 * $1,200), and an owner-typed deal (no items — the owner typed the price into a field, which
 * is a statement, just not in the text).
 */
export function priceIsStated(
  offer: Pick<
    OfferView,
    | 'discount_price'
    | 'offer_raw_text'
    | 'delivered_units'
    | 'price_model'
    | 'item_count'
  >,
): boolean {
  const price = offer.discount_price
  if (!price || price <= 0 || offer.item_count === 0) return true
  const text = offer.offer_raw_text
  const count = offer.delivered_units ?? 0
  const multipliedOut =
    count >= 2 &&
    (offer.price_model === 'per_unit' ||
      figureInText(Math.round((price * 100) / count) / 100, text))
  return multipliedOut || figureInText(price, text)
}

/**
 * A neurotoxin rate "per unit" outside the plausible range is a misread row, and its figure is
 * not a price at all: offer 8509 "$50 Off with Aspire Rewards (Reg. $3.75/unit. Minimum 120
 * units)" is stored as a $400 rate, and printed "Dysport in Orange — $400 per unit" in its title
 * and as a $400-a-unit Offer in its JSON-LD. The adapter drops both prices for such a row, so
 * every surface falls back to the discount the offer states and no Offer is published.
 */
export function isMisreadUnitRate(
  category: ClinicServiceCategory | null,
  basis: PriceBasis,
  price: number | null,
): boolean {
  if (category !== 'Neurotoxin' || basis.kind !== 'rate') return false
  if (basis.unit !== 'unit' || !price || price <= 0) return false
  const { min, max } = NEUROTOXIN_UNIT_PRICE_RANGE
  return price < min || price > max
}

/**
 * One unit's price, when the deal states it or we can divide to it from two numbers it states.
 * Null for a flat price — "Lip Flip $79" has no per-unit figure, and inventing one ($79 ÷ the
 * column's default 1) is how a $79 treatment would rank beside $10/unit Botox.
 *
 * Rounded to cents in cent space: 29900 ÷ 40 is exactly 747.5, whereas 299 ÷ 40 × 100 in
 * floating point is 747.4999… and would print $7.47 for "40 units for $299".
 */
export function perUnitPrice(
  deal: Pick<AnonymousDeal, 'dealPrice' | 'priceBasis'>,
): { amount: number; unit: string } | null {
  if (!(deal.dealPrice > 0)) return null
  const basis = deal.priceBasis
  if (basis.kind === 'rate') {
    return basis.unit ? { amount: deal.dealPrice, unit: basis.unit } : null
  }
  if (basis.kind === 'quantity') {
    return {
      amount: Math.round((deal.dealPrice * 100) / basis.count) / 100,
      unit: basis.unit,
    }
  }
  return null
}

/**
 * Neurotoxin per-unit prices outside this range are a misread row, not a deal. On 2026-09-18
 * the 221 neurotoxin rows with a per-unit figure ran $3.15 (Dysport) to $24.75, plus one at $400
 * (offer 8509, "$50 off… reg $3.75/unit" stored as a $400 rate) — which would otherwise have
 * printed "Botox from $400/unit" or topped a price-high-to-low sort.
 * ponytail: fixed bounds — revisit if a real neurotoxin is ever priced outside $2–$30 a unit.
 */
export const NEUROTOXIN_UNIT_PRICE_RANGE = { min: 2, max: 30 }

export type { ComparablePrice }

/**
 * The number a deal is ranked, filtered and summarised by ("from $X").
 *
 * Neurotoxins compare per unit — the decision of 2026-09-18, and the comparison a shopper
 * actually makes: "$10/unit" against "40 units for $299" ($7.48/unit), where comparing the
 * printed figures ranks the $10 as cheaper. A neurotoxin with no per-unit figure (a $79 lip
 * flip) returns null and sorts after every one that has one, rather than beside them.
 *
 * Everything else compares on what you pay. A rate per syringe, vial or session is a real
 * purchase ("$599 per syringe"); a rate per `unit` is not — nobody buys one unit of filler — and
 * a rate whose unit nothing names cannot be compared at all.
 *
 * Null means "not comparable": callers sort it last and drop it from price filters and minimums.
 * A `check`-tier deal is never comparable — so it sorts after every comparable deal, and no
 * typical price, "from $X" or vs-typical figure counts it. On 2026-09-28 every check-tier deal
 * already came out null below; this makes the rule the tier rather than a coincidence.
 */
export function comparablePrice(
  deal: Pick<AnonymousDeal, 'dealPrice' | 'priceBasis' | 'category'> &
    Partial<
      Pick<
        AnonymousDeal,
        'interpretation' | 'title' | 'description' | 'isFromPrice'
      >
    >,
): ComparablePrice | null {
  if (deal.interpretation?.tier === 'check') return null
  // Carried, not acted on: ranking, filters and "from $X" use `amount` alone. vsTypical() and
  // typicalPrices() read these — a floor or a Dysport unit is not a market price.
  const from = deal.isFromPrice ? { from: true as const } : {}
  if (deal.category === 'botox') {
    const unitPrice = perUnitPrice(deal)
    if (!unitPrice || unitPrice.unit !== 'unit') return null
    const { min, max } = NEUROTOXIN_UNIT_PRICE_RANGE
    if (unitPrice.amount < min || unitPrice.amount > max) return null
    const brand = neurotoxinBrand(deal.title, deal.description)
    return {
      amount: unitPrice.amount,
      perUnit: true,
      ...(brand && { brand }),
      ...from,
    }
  }
  if (!(deal.dealPrice > 0)) return null
  const basis = deal.priceBasis
  if (basis.kind === 'rate' && (!basis.unit || basis.unit === 'unit')) {
    return null
  }
  return { amount: deal.dealPrice, perUnit: false, ...from }
}

/** "units", "syringes", "sessions" — every price unit takes a regular plural. */
function pluralUnit(unit: string): string {
  return `${unit}s`
}

/** "$150", "$9.50", "$1,000" — never "$9.5", "$150.00" or "$0". */
export function formatPrice(value: number): string {
  const rounded = Math.round(value * 100) / 100
  // 'en-US' pinned: a server whose default locale is not US would print "$1.499" or "$1 499".
  return Number.isInteger(rounded)
    ? `$${rounded.toLocaleString('en-US')}`
    : `$${rounded.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
}

/** "30% off" — always a whole number. The pipeline stores percents like 30.1 and 20.04, and the
 *  admin deal cards printed them raw. Every "% off" label goes through here. */
export function formatPercentOff(percent: number): string {
  return `${Math.round(percent)}% off`
}

/**
 * What a deal's price block says. Pre-formatted, because the copy must be identical on every
 * surface that prints one.
 *
 * `savings` is nested under the comparison on purpose: it is non-null only when
 * `strikeThrough` is, so "Save $40" with no price to save it against is unrepresentable rather
 * than merely discouraged. That is the distinction the whole type exists to hold:
 *
 * - **"Save $40" / "Save 34%" is OUR arithmetic** on two numbers we are showing. Legitimate
 *   only with a real `regular_price` above a real `discount_price`.
 * - **"20% off" / "$100 off" is SOMEBODY ELSE'S CLAIM** — a scraper's reading of the clinic's
 *   free text, not a number the clinic typed into a field. Printable as the `lead` when it is
 *   the only thing the offer states, because then the whole card is about that one claim. NOT
 *   printable beside a price: see the price branch.
 *
 * We do not multiply the two together. `regular × (1 − pct/100)` would be a price claim no
 * provider ever published, and 14 offers have a `discount_amount` at or above their
 * `regular_price`, so it can reach or cross zero.
 *
 * `savings` and `note` are mutually exclusive by construction (the price branch is the only one
 * that sets `savings`, and it never sets `note`), so a surface may print whichever is present
 * and lose nothing. The regression grid asserts it.
 */
export interface DealPricing {
  /** For styling only — 'price' leads with a money figure, every other kind leads with words. */
  kind: 'price' | 'free' | 'discount' | 'none'
  /**
   * The headline: "$199", "From $149", "Free with membership", "20% off", "$100 value",
   * "Contact for pricing".
   */
  lead: string
  /**
   * What the lead's figure buys, printed right after it: "per unit", "per vial",
   * "for 40 units", then "for members" when the offer needs a paid plan ("$10 per unit for
   * members", "20% off for members"). Otherwise null for a flat price and for every non-price
   * lead — "20% off per unit" is not something any offer says. "each" only for a rate whose unit
   * nothing names.
   */
  basis: string | null
  /**
   * The quantity divided out, for a `quantity` basis only: "$7.48 per unit" beside "$299 for 40
   * units". Our arithmetic on two numbers the clinic published, like `savings`.
   */
  unitPrice: string | null
  /** `lead` and `basis` as one phrase, for surfaces that print a single string (titles, lists). */
  text: string
  /** Price before the discount. Set only when it is genuinely above the price shown. */
  strikeThrough: string | null
  /**
   * Our arithmetic. Non-null only alongside `strikeThrough`. On a rate the amount carries its
   * basis — "$2.50 per unit" — because a bare "Save $2.50" on "$10 per unit" reads as off the
   * whole treatment.
   */
  savings: { amount: string; percent: number } | null
  /** Context beside the lead: the offer's stated value, or its regular price. */
  note: string | null
}

/** "per unit" / "for 40 units" / "each" — the words `DealPricing.basis` prints. */
function basisWords(basis: PriceBasis): string | null {
  if (basis.kind === 'rate') return basis.unit ? `per ${basis.unit}` : 'each'
  if (basis.kind === 'quantity') {
    return `for ${basis.count.toLocaleString('en-US')} ${pluralUnit(basis.unit)}`
  }
  return null
}

/**
 * Decide the price block once, for dealCard, pricingBreakdown and savedDealsRow.
 *
 * Measured over the 814 visible offers on 2026-09-16: 482 publish a price (275 with a real
 * comparison, 20 of them a `price_model = 'from'` floor), 27 reach 100% off, and 305 publish no
 * price but every one of them states a discount: 161 a percentage, 144 a dollar amount, none
 * both, **none neither**. So 'none' — "Contact for pricing" — is currently unreachable. It is
 * kept because an offer with neither is still possible tomorrow; it used to be the render for
 * 332 of 814 offers, every one of which was stating a discount we were throwing away.
 *
 * Every branch here prints the weakest claim the row supports, because the columns it reads are
 * a scraper's reading of marketing copy and the output is a public price promise. Three of the
 * inputs exist only to weaken a claim the raw numbers would overstate: `requiresMembership`,
 * `isFromPrice` and the "up to" hedge in `description`.
 */
export function dealPricing(deal: {
  dealPrice: number
  /** Missing reads as `total` — the claim-free default: no basis is printed. */
  priceBasis?: PriceBasis
  originalPrice: number
  discountPercent: number
  discountAmount?: number
  /** `promo_offer_master.is_membership_required` — qualifies a 100%-off row. */
  requiresMembership?: boolean
  /** `price_model = 'from'` — the price is a floor the clinic published, not the price. */
  isFromPrice?: boolean
  /**
   * The offer's own words. Read ONLY to keep its "up to" hedge, and to pick the discount it
   * states when the row carries both a percent and an amount.
   */
  description?: string
}): DealPricing {
  const stated = statedPricing(deal)
  // 455 of 947 live deals need a paid membership (2026-09-23), and "$12 per unit" beside no
  // condition read as everyone's price. "Free with membership" already says it.
  const members =
    deal.requiresMembership &&
    (stated.kind === 'price' || stated.kind === 'discount')
      ? 'for members'
      : null
  if (stated.kind !== 'price') {
    return {
      ...stated,
      basis: members,
      unitPrice: null,
      text: members ? `${stated.lead} ${members}` : stated.lead,
    }
  }
  const basis = deal.priceBasis ?? { kind: 'total' }
  const words = basisWords(basis)
  const shown = [words, members].filter(Boolean).join(' ') || null
  const unitPrice =
    basis.kind === 'quantity'
      ? perUnitPrice({ ...deal, priceBasis: basis })
      : null
  return {
    ...stated,
    basis: shown,
    unitPrice: unitPrice
      ? `${formatPrice(unitPrice.amount)} per ${unitPrice.unit}`
      : null,
    text: shown ? `${stated.lead} ${shown}` : stated.lead,
    // The saving on a rate is a saving per unit, and says so.
    savings:
      stated.savings && basis.kind === 'rate' && words
        ? { ...stated.savings, amount: `${stated.savings.amount} ${words}` }
        : stated.savings,
  }
}

/** Everything dealPricing() decides that does not depend on the price basis. */
function statedPricing(
  deal: Parameters<typeof dealPricing>[0],
): Omit<DealPricing, 'basis' | 'unitPrice' | 'text'> {
  const price = deal.dealPrice
  const regular = deal.originalPrice
  const percent = deal.discountPercent
  const amount = deal.discountAmount ?? 0

  // "Save up to 50% off all our Laser Services", "Enjoy up to $120 off", "(Up to $1,000 Value)":
  // 9 visible offers hedge their own number and 8 of them render one here. `discount_percent`
  // and `discount_amount` keep the number and drop the hedge, which states a firmer discount
  // than the clinic did. No column carries it, so it is read from the offer text.
  // ponytail: a bare substring test. A false positive only ever softens our own claim, which is
  // the safe direction; tighten it only if a row shows up where "up to" is about something else.
  const hedge = /\bup to\b/i.test(deal.description ?? '') ? 'Up to ' : ''

  if (price > 0) {
    const comparable = regular > price
    return {
      kind: 'price',
      // "From $149" / "From $8 per unit": all 20 offers with `price_model = 'from'` read
      // "Starting at", "From" or "as low as" in their own text ("Laser Hair Removal as Low as
      // $50"). A flat "$50" publishes a floor as the price.
      lead: `${deal.isFromPrice ? 'From ' : ''}${formatPrice(price)}`,
      strikeThrough: comparable ? formatPrice(regular) : null,
      savings: comparable
        ? {
            amount: formatPrice(regular - price),
            // From the prices, not from `discount_percent`: 13 offers carry a scraped percent
            // that disagrees with their own two prices by more than 5 points, and the card was
            // printing that percent next to the figures it contradicts.
            percent: Math.round((1 - price / regular) * 100),
          }
        : null,
      // NO note. A priced card used to print the row's stated discount here whenever there was
      // no comparison to show, and that asserted a discount off the very figure beside it. All 7
      // live rows that reach it: 8569/8584/8598 are "PicoWay lower body $200 special" with
      // `discount_amount` = the price, rendering "$200 / $200 off" — free, by implication;
      // 8116 is "Botox at Just $10/Unit" with amount 120, a number the offer never mentions;
      // 1415's 18% is "18% less than the equivalent Botox" (a competitor, not a discount); and
      // 7900's 15% is "off additional services and products", not off its $200 gift card. Only
      // 7665 was right. A claim wrong on 6 of 7 rows earns no slot — the price stands alone.
      note: null,
    }
  }

  // No published price. "100% off" IS free, so it reads as free whether or not the row also
  // carries `discount_price = 0` — and a price above zero outranks the claim, which is why this
  // sits below the branch above. A percent over 100 is unusable rather than printable, so it
  // lands here too instead of advertising "150% off".
  if (percent >= 100) {
    return {
      kind: 'free',
      // Never the bare word "Free". Not one of the 27 live rows is a giveaway: 17 are
      // `is_membership_required` benefits of a $99–$1,925 plan, and the other 10 hang off a
      // purchase — "Buy 40+ units and get a FREE Facial", "Juvederm Filler: Buy One Get One
      // Free", "complimentary add-on". The card's title is the *purchased* product's
      // `item_name` ("Botox", "Juvéderm"), the old grid card never rendered the description, and
      // no surface renders `termsAndConditions` — so "Free" beside that title promised a free
      // Botox treatment. The condition belongs in the headline, where it cannot be dropped.
      // ponytail: `is_membership_required` is the only condition the schema carries; everything
      // else collapses to "with purchase", which is true of all 10 today. If the pipeline ever
      // structures the rest, name them.
      lead: deal.requiresMembership
        ? 'Free with membership'
        : 'Free with purchase',
      strikeThrough: null,
      savings: null,
      // 7 of the 27 carry a regular_price, which is the "$100 value" the offer text itself
      // states. Context, not a saving: there is no second number to subtract it from.
      note: regular > 0 ? `${formatPrice(regular)} value` : null,
    }
  }

  // Percent before amount — deterministic, because "20% off" and "$100 off" on one card say two
  // different things — unless only the amount is in the offer's own words. Every row whose
  // price is dropped as unstated carries both, and the percent is usually the pipeline's own
  // division: 7122 "225 units save $75" has 9.09%, 9338 "$50 off per syringe" 8.33%.
  const amountIsTheClaim =
    amount > 0 &&
    figureInText(amount, deal.description) &&
    !percentInText(percent, deal.description)
  if (percent > 0 && !amountIsTheClaim) {
    return {
      kind: 'discount',
      lead: `${hedge}${formatPercentOff(percent)}`,
      strikeThrough: null,
      savings: null,
      // Context only — we do not multiply it out. 10 of the 161 carry a regular price.
      note: regular > 0 ? `Regularly ${formatPrice(regular)}` : null,
    }
  }

  if (amount > 0) {
    // `discount_amount` at or above the regular price is not a discount off it — it is the
    // offer's stated VALUE, which the pipeline puts in the same column. All 7 live rows of that
    // shape say so in their own words: "one complimentary Chin Tox treatment per month ($100
    // value)", "1 Filler Boost or 1 Sculptra Vial (Up to $1,000 Value)", "complimentary
    // Volbella XC treatment ($450 value) with 40+ units of Botox". "$100 off" invents a
    // discount; "$100 value" is the number the clinic published. (This is the old
    // `regular > amount` note guard, moved to where the claim is: the lead, not the context.)
    const statesValue = regular > 0 && amount >= regular
    return {
      kind: 'discount',
      lead: `${hedge}${formatPrice(amount)} ${statesValue ? 'value' : 'off'}`,
      strikeThrough: null,
      savings: null,
      // "Regularly $100" beside "$100 value" is the same number twice, and beside "$100 off" it
      // would imply the $0 this function exists not to publish. 6 of the 144 keep it.
      note: statesValue
        ? null
        : regular > 0
          ? `Regularly ${formatPrice(regular)}`
          : null,
    }
  }

  return {
    kind: 'none',
    lead: 'Contact for pricing',
    strikeThrough: null,
    savings: null,
    note: null,
  }
}

/**
 * Transform a Supabase Business into a provider-like shape for provider pages.
 */
/**
 * A directory row as the provider pages print it. The slug comes from the view, which computes it
 * in SQL (lowercase, runs of anything else to "-"), so a link and its lookup cannot diverge. There
 * is no id: the public directory carries no business_id, so nothing here joins to an offer.
 */
export function businessToProvider(biz: PublicBusiness) {
  // Address first: this business's own address outranks anything keyed on its city name.
  const { state, stateCode } = inferState(biz.city, biz.address)

  return {
    name: biz.name ?? 'Unknown Business',
    slug: biz.slug ?? '',
    description: `${biz.category ?? 'Medical spa'} in ${biz.city ?? 'your area'}`,
    category: biz.category ?? '',
    // Slugified from the business's OWN category, not routed through getCategorySlug().
    // `master_business_info.category` holds business types ("Medical spa"); that function maps
    // `clinic_services.service_category`, a different vocabulary entirely, so every provider
    // resolved to the OTHER bucket's slug. Typing the taxonomy on the DB enum surfaced it.
    categorySlug: (biz.category ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, ''),
    address: biz.address ?? '',
    city: biz.city ?? '',
    state,
    stateCode,
    rating: biz.score ?? 0,
    reviewCount: biz.review_count ?? 0,
    tier: 'unclaimed' as const,
    isVerified: false,
  }
}

export { CITY_STATE_MAP, TREATMENT_TO_DB }

/**
 * The row-card shape of an offer: what OfferRow prints, as plain JSON. Used by the homepage's
 * client-side price panel, which cannot carry whole OfferViews
 * (one per pair per city is ~70KB of HTML; this is a fifth of that). The price strings are
 * dealPricing()'s, so a row never disagrees with the card or the deal page.
 */
export function offerToLean(offer: OfferView): LeanOffer {
  return {
    ...dealToLean(offerToAnonymousDeal(offer)),
    title:
      scrubProviderIdentity(offer.service_name, offer.master_business_info) ||
      'Treatment',
  }
}

/**
 * The same row-card shape from an AnonymousDeal — what the browse pages hold — so DealCard
 * prints OfferRow rather than a card of its own.
 */
export function dealToLean(deal: AnonymousDeal): LeanOffer {
  const pricing = dealPricing(deal)
  return {
    id: Number(deal.id),
    title: deal.title,
    subtitle: offerSubtitle(deal.title, deal.description),
    treatment: deal.category,
    cityLabel: deal.locationArea.trim() || null,
    lead: pricing.lead,
    basis: pricing.basis,
    strikeThrough: pricing.strikeThrough,
    savingsPercent: pricing.savings?.percent ?? null,
    leadIsPrice: pricing.kind === 'price',
    interpretationTier: deal.interpretation.tier,
    requiresMembership: deal.requiresMembership ?? false,
    clinicConfirmed: deal.clinicConfirmedAt != null,
    comparable: comparablePrice(deal),
    ...(deal.interpretation.notes.includes('clinic-wide') && {
      clinicWide: true,
    }),
  }
}

// ─── Interpretation: how sure we are of our reading ─────────────────────────
// These three live here rather than in offers.ts, price-defects.ts or interpretation.ts because
// offerToAnonymousDeal() calls interpretOffer(), and each of those modules imports this one.

/**
 * Clinic-wide wording: "10% off all products and services", "$50 off (any-service September
 * offer)", "15% off all purchases", "10% off first treatment". The owner's rule (2026-09-16): a
 * blanket offer carries no treatment badge and is on no treatment page, whatever service the
 * pipeline linked it to. 34 live rows on 2026-09-23.
 * ponytail: a regex, like the price-basis hedges. A clinic-wide offer the pipeline rewrote to
 * name one service ("10% off Halo Laser treatment…") has no such words — blanketOfferIds() in
 * offers.ts catches those from their siblings.
 */
const BLANKET_WORDING =
  /\b(any[- ]?(service|treatment|procedure)s?\b|all (of our )?(services|treatments|products|purchases|procedures)\b|products and services|services and products|site-?wide|store-?wide|entire (menu|service|treatment)|every (service|treatment)\b|gift ?cards?\b|skin ?care products|off (your )?first (treatment|visit|appointment|service)\b)/i

export function isBlanketWording(text: string | null | undefined): boolean {
  return BLANKET_WORDING.test(text ?? '')
}

/**
 * A priced row the price-basis rules can print only with a guess, or not at all.
 *
 * The rules above run on every render, so a new pipeline row is labelled by them the moment it
 * lands — nothing needs to run for that. What they cannot do is repair a row the pipeline stored
 * wrong, and each defect below is one of those shapes, found in the 2026-09-17 audit.
 * `npm run prices:check` and the 6-hourly `/api/cron/gates` Vercel cron run this over every
 * visible offer and fail on a row that is not already in supabase/price-defects-baseline.json, so
 * a pipeline change that starts producing them is caught by the gate rather than by a customer.
 * The fixes belong in the pipeline — see .planning/SCHEMA-GOVERNANCE-ASK.md, Ask 3. On the site a
 * defect makes the deal `check` tier ("Confirm when booking"): see interpretOffer().
 *
 * - `rate-unit-unknown` — a per-unit rate whose unit nothing names; it prints "$499 each".
 * - `misread-unit-rate` — a neurotoxin "rate" no neurotoxin costs (offer 8509, $400/unit); the
 *   adapter drops its price and the card falls back to the stated discount.
 * - `price-not-in-text` — the stored price appears nowhere in the offer's own words. Mostly a
 *   stated discount applied to a regular price the clinic never published ("$100 off 40+ units"
 *   stored as $460). The adapter drops such a price since 2026-09-24 (`priceIsStated()`), so the
 *   card leads with the stated discount instead — but the row is still wrong at the source, so
 *   it is still flagged here. A total that is a stated rate multiplied out by the row's count is
 *   exempt ("100 units … at $12/unit" → $1,200).
 * - `bare-neurotoxin-price` — a neurotoxin `total` in the per-unit range: "$10 Botox" is almost
 *   certainly $10 a unit, but nothing says so, and it prints as a $10 treatment.
 *
 * ponytail: text matching, like offerPriceBasis — it flags, it never rewrites. A false positive
 * costs one baseline entry; tighten a rule only when one shows up.
 */
export type PriceDefect =
  | 'rate-unit-unknown'
  | 'misread-unit-rate'
  | 'price-not-in-text'
  | 'bare-neurotoxin-price'

export function priceDefects(offer: OfferView): PriceDefect[] {
  const price = offer.discount_price
  if (!price || price <= 0) return []

  const defects: PriceDefect[] = []
  const basis = offerPriceBasis(offer)
  if (basis.kind === 'rate' && !basis.unit) defects.push('rate-unit-unknown')
  if (isMisreadUnitRate(offer.service_category, basis, price)) {
    defects.push('misread-unit-rate')
  }
  if (!priceIsStated(offer)) defects.push('price-not-in-text')

  const { min, max } = NEUROTOXIN_UNIT_PRICE_RANGE
  if (
    offer.service_category === 'Neurotoxin' &&
    basis.kind === 'total' &&
    price >= min &&
    price <= max
  ) {
    defects.push('bare-neurotoxin-price')
  }
  return defects
}

/**
 * How sure we are of our reading of one offer: a tier, the reasons that lowered it, and notes
 * that give context without lowering it. See `DealInterpretation` in src/types/deal.ts and
 * `TIER_LABELS` / `describeInterpretation()` in interpretation.ts, which re-exports this.
 *
 * `check` on any priceDefects() or a discount lead the text doesn't state; else `worked-out` on
 * any other reason; else `as-advertised`.
 * Every test here is one the price rules above already make — the same `priceIsStated`,
 * `figureInText`, `offerPriceBasis`, `neurotoxinBrand` and `isBlanketWording` — so a label can
 * never disagree with the price block it sits beside.
 */
export function interpretOffer(offer: OfferView): DealInterpretation {
  const text = offer.offer_raw_text
  const price = offer.discount_price ?? 0
  const priceBasis = offerPriceBasis(offer)
  // The price offerToAnonymousDeal() shows: dropped when misread or not in the offer's words.
  const shown =
    price > 0 &&
    priceIsStated(offer) &&
    !isMisreadUnitRate(offer.service_category, priceBasis, price)
  const dealPrice = shown ? price : 0
  const category = dbCategoryToTreatment(offer.service_category)

  const reasons: InterpretationReason[] = []
  // "$299 for 40 units" prints "$7.48 per unit" beside it — ours, unless the text says it too.
  const unitPrice =
    priceBasis.kind === 'quantity'
      ? perUnitPrice({ dealPrice, priceBasis })
      : null
  if (unitPrice && !figureInText(unitPrice.amount, text)) {
    reasons.push('per-unit-divided')
  }
  // Stated, but not as this figure: priceIsStated() passed it as a rate × count.
  if (shown && offer.item_count !== 0 && !figureInText(price, text)) {
    reasons.push('multiplied-out')
  }
  if (shown && offer.item_count > 1) reasons.push('bundle')
  if (
    category === 'botox' &&
    comparablePrice({ dealPrice, priceBasis, category }) &&
    !neurotoxinBrand(offer.service_name, text)
  ) {
    reasons.push('toxin-brand-unnamed')
  }
  if (priceDefects(offer).length > 0) reasons.push('price-defect')
  // With no price shown the card leads with the percent or amount off, and that figure must be
  // the clinic's too: on 2026-09-28, 5 live rows led with one their words never state. Whichever
  // figure leads (see statedPricing), it is stated when either is. The one shape we can vouch
  // for is our own arithmetic on "buy N, get M free" — M of N + M free — so a percent that
  // matches it is our math; one that doesn't (10431 "Buy 6 … get 1 free" stored as 16.67%, where
  // 1 of 7 is 14%) is not a reading we can stand behind either.
  const discount = printableDiscount(offer)
  const percent = discount.percent ?? 0
  const amount = discount.amount ?? 0
  const discountLeads = !shown && percent < 100 && (percent > 0 || amount > 0)
  if (
    discountLeads &&
    !(percent > 0 && percentInText(percent, text)) &&
    !(amount > 0 && figureInText(amount, text))
  ) {
    const free = buyGetFree(text)
    reasons.push(
      percent > 0 &&
        free &&
        Math.round(percent) ===
          Math.round((100 * free.free) / (free.buy + free.free))
        ? 'discount-derived'
        : 'discount-unstated',
    )
  }

  const notes: InterpretationNote[] = []
  if (shown && offer.price_model === 'from') notes.push('from-price')
  if ((offer.regular_price ?? 0) > 0 && statedRegularPrice(offer) === 0) {
    notes.push('regular-price-unstated')
  }
  if (offer.is_membership_required) notes.push('members-only')
  if (offer.is_new_customer_required) notes.push('new-patients-only')
  if (isBlanketWording(text)) notes.push('clinic-wide')
  else if (!category) notes.push('no-treatment')
  // A discount with no price to compare. 100% off reads "Free with …", which says so already.
  if (discountLeads) notes.push('discount-only')

  return {
    tier: reasons.some((r) => r === 'price-defect' || r === 'discount-unstated')
      ? 'check'
      : reasons.length > 0
        ? 'worked-out'
        : 'as-advertised',
    reasons,
    notes,
  }
}
