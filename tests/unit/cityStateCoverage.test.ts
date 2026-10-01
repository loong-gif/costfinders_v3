/**
 * Every city with visible deals must resolve a state, or its page is never generated.
 *
 * THIS TEST IS THE POINT OF THE §3 FIX, not a sanity check on it.
 *
 * The failure it guards has now happened twice in the same shape. `generateStaticParams` for
 * `/[state]/[city]` does `states.find(s => s.code === city.stateCode)` and pushes NOTHING when that
 * returns undefined. So a city whose state cannot be resolved does not 404, does not error, does not
 * warn — it simply has no URL. Measured 2026-09-16, before this fix: 23 of 42 cities with live deals
 * were unresolvable and 204 of 799 deals (26%) were unreachable from anywhere on the site. Both
 * halves were silent: `CITY_STATE_MAP` was a hand-written 30 cities, and `SUPPORTED_STATES` was a
 * hand-written 4 states.
 *
 * Both lists are now derived, so the immediate bug is gone. This test exists because the NEXT
 * unresolvable city should fail the gate rather than quietly disappear. It runs against the live database
 * on purpose — the data is what moves here, not the code.
 *
 * Skips itself, loudly, without credentials, following tests/unit/envWhitespace.test.ts: a test that
 * cannot reach the database must not turn into a green tick that proves nothing.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { createClient } from '@supabase/supabase-js'
import {
  inferState,
  stateFromAddress,
  US_STATE_NAMES,
} from '@/lib/data/adapters'
import { getStates } from '@/lib/mock-data/states'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const live = Boolean(url && key)

if (!live) {
  console.warn(
    'cityStateCoverage: SKIPPED — NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY are not set, so city ' +
      'coverage is UNVERIFIED, not verified. The pre-push gate loads .env.local.',
  )
}

interface VisibleBusiness {
  city: string
  address: string | null
  deals: number
}

/**
 * Businesses with at least one visible offer, where visible is the canonical predicate from
 * src/lib/data/offers.ts: is_active AND (no campaign end date OR it has not passed). The promotion
 * join MUST be left — a third of offers have no promotion and an inner join drops them.
 */
async function visibleBusinesses(): Promise<VisibleBusiness[]> {
  const db = createClient(url as string, key as string, {
    auth: { persistSession: false },
  })

  // The anon key can no longer read the catalogue tables (20260924050002); the site reads the
  // identity-scrubbed views, and so does this test. public_offers is already is_active-only and
  // carries the promotion's end date and the business city as flat columns.
  const { data, error } = await db
    .from('public_offers')
    .select('id, campaign_end_date, business_city')
  if (error) throw new Error(`could not read offers: ${error.message}`)

  // Addresses come from the directory view, which has no business_id: the test only needs one
  // address per city that carries a state, not the address of a specific clinic.
  const { data: directory, error: directoryError } = await db
    .from('public_business_directory')
    .select('city, address')
  if (directoryError)
    throw new Error(`could not read businesses: ${directoryError.message}`)

  const addressByCity = new Map<string, string | null>()
  for (const row of directory ?? []) {
    const city = row.city?.trim()
    if (!city) continue
    const current = addressByCity.get(city) ?? null
    // Keep an address that actually carries a state, so the assertion tests the best case
    // available for this city rather than whichever row came back first.
    if (!stateFromAddress(current) && stateFromAddress(row.address)) {
      addressByCity.set(city, row.address ?? null)
    } else if (!addressByCity.has(city)) {
      addressByCity.set(city, row.address ?? null)
    }
  }

  const today = new Date().toISOString().slice(0, 10)
  const byCity = new Map<string, VisibleBusiness>()

  for (const offer of data ?? []) {
    if (offer.campaign_end_date && offer.campaign_end_date < today) continue
    const city = offer.business_city?.trim()
    if (!city) continue
    const entry = byCity.get(city) ?? {
      city,
      address: addressByCity.get(city) ?? null,
      deals: 0,
    }
    entry.deals++
    byCity.set(city, entry)
  }

  return [...byCity.values()]
}

test(
  'every city with visible deals resolves a state',
  { skip: !live },
  async () => {
    const cities = await visibleBusinesses()
    assert.ok(
      cities.length > 0,
      'no cities with visible deals — the query is wrong, not the data',
    )

    const stranded = cities
      .filter((c) => !inferState(c.city, c.address).stateCode)
      .sort((a, b) => b.deals - a.deals)

    assert.deepEqual(
      stranded.map((c) => `${c.city} (${c.deals} deals)`),
      [],
      'These cities have live deals but resolve no state, so generateStaticParams emits no page for ' +
        'them and every one of their deals is unreachable. Fix by making the address carry a state, ' +
        'or add the city to CITY_STATE_MAP in src/lib/data/adapters.ts.',
    )
  },
)

test(
  'every resolved state is one the [state] route can serve',
  { skip: !live },
  async () => {
    const cities = await visibleBusinesses()
    const served = new Set(getStates().map((s) => s.code))

    const unserved = [
      ...new Set(
        cities
          .map((c) => inferState(c.city, c.address).stateCode)
          .filter((code) => code && !served.has(code)),
      ),
    ]

    assert.deepEqual(
      unserved,
      [],
      'A city resolved these state codes but getStates() does not list them, so states.find() ' +
        'returns undefined and the city page is silently not generated. SUPPORTED_STATES is derived ' +
        'from US_STATE_NAMES, so this can only fail on a code that is not a real US state.',
    )
  },
)

test(
  'no city with visible deals is ambiguous across two states',
  { skip: !live },
  async () => {
    const db = createClient(url as string, key as string, {
      auth: { persistSession: false },
    })
    const { data, error } = await db
      .from('public_business_directory')
      .select('city, address')
    if (error) throw new Error(`could not read businesses: ${error.message}`)

    const codesByCity = new Map<string, Set<string>>()
    for (const row of data ?? []) {
      const city = row.city?.trim()
      const resolved = stateFromAddress(row.address)
      if (!city || !resolved) continue
      const key = city.toLowerCase()
      const codes = codesByCity.get(key) ?? new Set<string>()
      codes.add(resolved.stateCode)
      codesByCity.set(key, codes)
    }

    const withDeals = new Set(
      (await visibleBusinesses()).map((c) => c.city.toLowerCase()),
    )
    const ambiguous = [...codesByCity.entries()]
      .filter(([city, codes]) => codes.size > 1 && withDeals.has(city))
      .map(([city, codes]) => `${city}: ${[...codes].sort().join('/')}`)

    assert.deepEqual(
      ambiguous,
      [],
      'This city name exists in more than one state AND has visible deals, so getCityStates() has ' +
        "to pick a winner by majority and the losing state's deals are filed under the wrong state. " +
        'The city-keyed lookup cannot be made right for this; the route needs a (city, state) key. ' +
        '"Lake Forest" is already CA×3 and IL×1 in this data but has zero visible deals, which is ' +
        'the only reason this is not failing today.',
    )
  },
)

test('US_STATE_NAMES and getStates() agree, and the slugs are URL-safe', () => {
  const states = getStates()
  assert.equal(states.length, Object.keys(US_STATE_NAMES).length)
  for (const state of states) {
    assert.equal(US_STATE_NAMES[state.code], state.name)
    assert.match(
      state.slug,
      /^[a-z-]+$/,
      `${state.name} produced a non-URL-safe slug`,
    )
  }
  // The four the marketing copy names must still resolve, or the existing pages break.
  for (const slug of ['california', 'arizona', 'colorado', 'oklahoma']) {
    assert.ok(
      states.some((s) => s.slug === slug),
      `${slug} must remain a valid state slug`,
    )
  }
})
