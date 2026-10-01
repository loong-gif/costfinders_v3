import { Constants } from '@/types/supabase.generated'

/**
 * Pre-claim anonymity. A clinic's name is the thing a claim unlocks (owner decision: claims are
 * how CostFinders collects contact details), so nothing a signed-out visitor sees may name it.
 *
 * The clinic's own words leak it: offer text and plan names are scraped from its site ("NakedMD
 * Members Club — Chin Filler…", "Membership required: Skinjectables Vault Membership", "…at
 * Alchemy when you get 20+ units", "consultation with Dr. K"). This is applied where an
 * AnonymousDeal is built (offerToAnonymousDeal in src/lib/data/adapters.ts), so every pre-claim
 * surface gets it without asking. (The Google rating leaked it too, and is not carried at all.)
 *
 * The public catalogue is scrubbed by a SQL port of this file before it leaves the database
 * (scrub_identity_terms / provider_identity_terms in
 * supabase/migrations/20260924050001_public_catalogue_views.sql), so rows from public_offers
 * reach here with no name and this is a no-op on them apart from named doctors. A change to a
 * word list or rule here needs the same change there, in a new migration.
 */

export interface ProviderIdentity {
  name?: string | null
  website?: string | null
  city?: string | null
}

/** Case, accents, "&" and "+" folded away: "Belle Âme" = "belleame", "Faces+" = "facesplus". */
function compact(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\+/g, 'plus')
    .replace(/[^a-z0-9]/g, '')
}

/** A word of offer text. "Faces+" keeps its plus, which is part of that clinic's name. */
const WORD = /[\p{L}\p{M}\p{N}]+\+?/gu
/** A word of a clinic name — "&" counts, so "Ageless & Beautiful" compacts as the text does. */
const NAME_WORD = /[\p{L}\p{M}\p{N}]+\+?|&/gu

/**
 * Trailing words that say what a clinic is, not which one. Peeled off to reach the name's core:
 * "NakedMD Med Spa Tucson" → "NakedMD", "Iconique Medical Aesthetics" → "Iconique".
 */
const SUFFIX_WORDS = new Set([
  'med',
  'medical',
  'medspa',
  'spa',
  'md',
  'aesthetics',
  'aesthetic',
  'esthetics',
  'wellness',
  'center',
  'centre',
  'clinic',
  'institute',
  'studio',
  'lounge',
  'bar',
  'face',
  'skin',
  'body',
  'care',
  'skincare',
  'beauty',
  'solutions',
  'anti',
  'aging',
  'cosmetic',
  'cosmetics',
  'dermatology',
  'laser',
  'rejuvenation',
  'group',
  'llc',
  'inc',
  'pllc',
  'co',
])

/** Joining words a core may not end on ("House of", "BlueWater Wellness and"). */
const CONNECTORS = new Set(['and', 'of', 'the', 'by', 'at', 'for', 'dr'])

/** The same idea for a website's name, whose words run together ("seranovamedspa"). */
const DOMAIN_SUFFIXES = [
  // "nakedmd" → "naked", which is how that clinic brands its products ("Naked Lips").
  'md',
  'medicalspa',
  'medspa',
  'spa',
  'aesthetics',
  'aesthetic',
  'medical',
  'wellness',
  'center',
  'clinic',
  'solutions',
  'skin',
  'face',
  'bar',
]

/** Hosts that are someone else's site, so their name is not the clinic's. */
const PLATFORM_HOSTS = new Set([
  'facebook',
  'instagram',
  'linktr',
  'glossgenius',
  'wixsite',
  'square',
  'squareup',
  'vagaro',
  'booksy',
  'mindbodyonline',
  'yelp',
  'google',
])

/**
 * Words too common to strip on their own, however a clinic is named: "Glow Up Med Spa" keeps
 * "FREE Glow & Go Facial", "Skin Maison" keeps "Skin Treatments 10% off". Every service and
 * category name is in here too — a clinic named after a treatment must not lose the treatment
 * from its own offers.
 * ponytail: a word list. A clinic whose core is some other everyday word loses that word from
 * its own text (never from another clinic's); add the word here when one shows up.
 */
const GENERIC = new Set(
  [
    'beauty',
    'beautiful',
    'glow',
    'skin',
    'body',
    'face',
    'faces',
    'facial',
    'laser',
    'med',
    'medical',
    'spa',
    'aesthetic',
    'aesthetics',
    'wellness',
    'health',
    'center',
    'clinic',
    'studio',
    'bar',
    'lounge',
    'house',
    'new',
    'pure',
    'true',
    'elite',
    'luxe',
    'luxury',
    'vip',
    'signature',
    'premier',
    'prime',
    'advanced',
    'modern',
    'total',
    'perfect',
    'radiant',
    'radiance',
    'fresh',
    'youth',
    'young',
    'ageless',
    'forever',
    'timeless',
    'bliss',
    'glam',
    'lash',
    'brow',
    'smooth',
    'sculpt',
    'contour',
    'renew',
    'revive',
    'restore',
    'vitality',
    'hydration',
    'tox',
    'members',
    'member',
    'membership',
    'club',
    'natural',
    'bella',
    'divine',
    'serenity',
    'harmony',
    'balance',
    'image',
    'derm',
    'dermatology',
    'plastic',
    'surgery',
    'iv',
    'drip',
    'medspa',
    'medicalspa',
    'botox',
    'filler',
    'fillers',
    'lips',
    'therapy',
    'removal',
    'form',
    'the',
    'and',
    ...Constants.public.Enums.clinic_service_name_enum,
    ...Constants.public.Enums.clinic_service_category_enum,
  ].map(compact),
)

/** The website's own name: "https://www.nakedmd.com/pages/…" → "nakedmd". */
function siteLabel(website: string): string | null {
  const host = website
    .trim()
    .replace(/^[a-z]+:\/\//i, '')
    .split(/[/?#]/)[0]
    .replace(/^www\./i, '')
  const labels = host.split('.').filter(Boolean)
  const label = labels.length >= 2 ? labels[labels.length - 2] : null
  return label && !PLATFORM_HOSTS.has(label.toLowerCase()) ? label : null
}

/**
 * Every spelling of this clinic's identity worth stripping, compacted:
 * - the full name and each part of it ("Faces Plus: Dr. Steven Cohen" → both halves);
 * - each part with its trailing generic and city words peeled off, and its first word when that
 *   word is distinctive ("Seranova Sculpt and Beauty" → "seranova");
 * - the website's name, peeled the same way ("bluewaterwellnesscenter" → "bluewater").
 * Never a generic word, and never the city ("Newport Beach Med Spa" must not strip "Newport
 * Beach" from its own offers).
 */
export function identityTerms(business: ProviderIdentity): Set<string> {
  const cityWords = (business.city ?? '').match(WORD)?.map(compact) ?? []
  const city = cityWords.join('')
  const terms = new Set<string>()
  const add = (term: string, min = 3) => {
    if (
      term.length >= min &&
      !GENERIC.has(term) &&
      term !== city &&
      !cityWords.includes(term)
    ) {
      terms.add(term)
    }
  }

  const name = business.name?.trim() ?? ''
  if (name) {
    add(compact(name))
    const parts = name.split(/\s*[:|,(]\s*|\s+[-–—]\s+/)
    for (const [index, part] of parts.entries()) {
      const tokens = part.match(NAME_WORD)?.map(compact) ?? []
      while (tokens[0] === 'the' || tokens[0] === 'dr') tokens.shift()
      if (tokens.length === 0) continue
      // Past the first part a name is often a keyword list ("… | Med Spa, Botox, Laser, Tattoo
      // Removal"), which must not strip treatments from the clinic's own offers. A later part is
      // kept only when none of its words is generic ("Faces Plus: Dr. Steven Cohen").
      if (index > 0 && tokens.some((t) => GENERIC.has(t))) continue
      add(tokens.join(''))
      // The first word alone only at 4+ letters, and only the name's own first word: "PCH" is a
      // whole core, "New" is not a name.
      if (index === 0) add(tokens[0], 4)
      while (tokens.length > 1) {
        const last = tokens[tokens.length - 1]
        const peelable =
          SUFFIX_WORDS.has(last) ||
          CONNECTORS.has(last) ||
          cityWords.includes(last)
        if (!peelable) break
        tokens.pop()
        if (!CONNECTORS.has(tokens[tokens.length - 1])) add(tokens.join(''))
      }
    }
  }

  const label = business.website ? siteLabel(business.website) : null
  if (label) {
    let site = compact(label)
    add(site, 4)
    for (let peeled = true; peeled; ) {
      peeled = false
      for (const suffix of DOMAIN_SUFFIXES) {
        if (site.endsWith(suffix) && site.length - suffix.length >= 4) {
          site = site.slice(0, -suffix.length)
          add(site, 4)
          peeled = true
          break
        }
      }
    }
  }
  return terms
}

/**
 * "Dr. K", "Dr Bonadkar", "Dr. Steven Cohen" — a named doctor fingerprints a clinic too.
 * ponytail: takes up to two capitalised words, so "with Dr. Smith Botox" would lose "Botox". No
 * live row reads that way: each ends the name at punctuation or a lowercase word.
 */
const DOCTOR =
  /\b(?:Dr|DR)\.?\s+[A-Z][\p{L}'’-]*(?:\s+[A-Z][\p{L}'’-]*(?=$|[\s.,;:!?)]))?/gu

const AFTER_PREPOSITION =
  /\b(?:at|from|with|by|to|for|of|in|visit|visiting)\s+$/i
const POSSESSIVE = /^['’]s\b/i

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * The text with this clinic's name, its website and any named doctor taken out. Whole words, any
 * case. After a preposition the name becomes "this provider" ("never tried at West before" →
 * "…at this provider before"); a possessive becomes "the provider's"; anywhere else it is
 * dropped ("NakedMD Members Club — Chin Filler" → "Members Club — Chin Filler").
 *
 * Pre-claim only. The reveal after a claim shows the clinic itself, and the admin and owner
 * screens that need the clinic's own words read the raw offer.
 */
export function scrubProviderIdentity(
  text: string | null | undefined,
  business: ProviderIdentity | null | undefined,
): string {
  if (!text) return ''
  let out = text.replace(DOCTOR, 'the doctor')
  if (!business?.name && !business?.website) return out

  const label = business.website ? siteLabel(business.website) : null
  if (label) {
    out = out.replace(
      new RegExp(
        `(?:https?://)?(?:www\\.)?${escapeRegExp(label)}\\.[a-z]{2,}(?:\\.[a-z]{2,})?(?:/\\S*)?`,
        'gi',
      ),
      "the provider's website",
    )
  }

  const terms = identityTerms(business)
  if (terms.size === 0) return out

  const tokens = [...out.matchAll(WORD)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }))
  const spans: { start: number; end: number }[] = []
  for (let i = 0; i < tokens.length; i++) {
    // Longest run first, up to eight words ("BlueWater Wellness and Med Spa" is five).
    for (let n = Math.min(8, tokens.length - i); n >= 1; n--) {
      const last = tokens[i + n - 1]
      // A name runs over spaces, "&" and hyphens only — never across ":" or "," into the next
      // phrase.
      let joined = true
      for (let k = i + 1; k < i + n && joined; k++) {
        joined = /^[\s&+-]*$/.test(
          out.slice(tokens[k - 1].end, tokens[k].start),
        )
      }
      if (joined && terms.has(compact(out.slice(tokens[i].start, last.end)))) {
        spans.push({ start: tokens[i].start, end: last.end })
        i += n - 1
        break
      }
    }
  }
  if (spans.length === 0) return out

  let result = ''
  let cursor = 0
  for (const span of spans) {
    const before = out.slice(cursor, span.start)
    const possessive = out.slice(span.end).match(POSSESSIVE)
    let replacement = ''
    if (possessive) {
      replacement = "the provider's"
      span.end += possessive[0].length
    } else if (AFTER_PREPOSITION.test(result + before)) {
      replacement = 'this provider'
    }
    result += before + replacement
    cursor = span.end
  }
  result += out.slice(cursor)

  const cleaned = result
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:!?)])/g, '$1')
    .replace(/\(\s*\)/g, '')
    .replace(/^[\s,;:—–-]+/, '')
    .trim()
  // The name led the sentence: "NakedMD members club…" still starts with a capital.
  return spans[0].start === 0 && /^\p{Ll}/u.test(cleaned)
    ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
    : cleaned
}

/**
 * The smallest city directory we publish. Below it, "Provider in <city>" on a deal card beside a
 * directory naming that city's clinics is a guess of one in three or better: on 2026-09-24, 13
 * cities with deals listed a single clinic (121 deals) and 17 listed three or fewer (167 deals).
 * Owner decision (option c): no directory there, and their provider pages are noindex and out of
 * the sitemap (the route still answers a direct link).
 * ponytail: a size cut. The real fix is naming a wider area than the city on pre-claim cards
 * (metro or county), once a city → area map exists; then this can go.
 */
export const MIN_PUBLIC_DIRECTORY = 4

/** The providers a city's public directory lists: every named one, or none when too few. */
export function publicDirectory<T extends { slug: string }>(
  providers: T[],
): T[] {
  const named = providers.filter((provider) => provider.slug)
  return named.length >= MIN_PUBLIC_DIRECTORY ? named : []
}
