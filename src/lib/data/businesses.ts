import { cache } from 'react'
import { stateFromAddress } from '@/lib/data/adapters'
import { logSupabaseError } from '@/lib/logger'
import { supabase } from '@/lib/supabase'
import type { PublicBusiness } from '@/types/supabase'

/**
 * The public provider directory (supabase/migrations/20260924050001_public_catalogue_views.sql):
 * name, address, city, rating, category and the provider route's slug. No business_id, phone,
 * website or socials, so nothing read here joins to an offer; anon cannot read
 * master_business_info itself since 20260924050002.
 */
const TABLE = 'public_business_directory'

export const getBusinesses = cache(async function getBusinesses(
  city?: string,
): Promise<PublicBusiness[]> {
  let query = supabase
    .from(TABLE)
    .select('name, address, city, review_count, score, category, slug')
    .order('score', { ascending: false, nullsFirst: false })

  if (city) {
    query = query.ilike('city', city)
  }

  const { data, error } = await query
  if (error) {
    logSupabaseError('getBusinesses', error)
    throw error
  }
  return (data ?? []) as PublicBusiness[]
})

export const getBusinessCities = cache(
  async function getBusinessCities(): Promise<
    { city: string; count: number }[]
  > {
    // SECURITY DEFINER since 20260924050001, so it answers anon although anon cannot read
    // master_business_info. The fallback counts the public directory, loudly.
    const { data, error } = await supabase.rpc('get_business_cities')

    if (error) {
      logSupabaseError('getBusinessCities', error)
      const { data: raw, error: rawError } = await supabase
        .from(TABLE)
        .select('city')

      if (rawError) {
        logSupabaseError('getBusinessCities', rawError)
        throw rawError
      }

      const counts = new Map<string, number>()
      for (const row of raw ?? []) {
        if (!row.city) continue
        counts.set(row.city, (counts.get(row.city) ?? 0) + 1)
      }

      return Array.from(counts.entries())
        .map(([city, count]) => ({ city, count }))
        .sort((a, b) => b.count - a.count)
    }

    return data ?? []
  },
)

/**
 * City (lowercased, trimmed) → the state its businesses are actually in.
 *
 * City-level pages have only a city name to work from, so they cannot call
 * `stateFromAddress()` per business. This reads every address once and resolves each city name to
 * one state, so `/[state]/[city]` and the sitemap stop depending on a hand-maintained map that
 * silently emitted no page for any city missing from it.
 *
 * Deliberately NOT routed through `get_business_cities()` like `getBusinessCities` above: its
 * `{city, count}` shape carries no state. This scans the directory directly so it cannot degrade
 * without someone editing this function.
 *
 * Ambiguity is resolved by count, and it is real: "Lake Forest" is 3 businesses in CA and 1 in IL.
 * Majority is the best a city-keyed lookup can do, which is exactly why per-business callers
 * should use `inferState(city, address)` instead. `tests/unit/cityStateCoverage.test.ts` fails if a
 * city with VISIBLE DEALS is ambiguous, so the day a collision starts mattering, the gate says so rather
 * than the site quietly filing an Illinois clinic under California.
 */
export const getCityStates = cache(async function getCityStates(): Promise<
  Record<string, { state: string; stateCode: string }>
> {
  const { data, error } = await supabase.from(TABLE).select('city, address')

  if (error) {
    logSupabaseError('getCityStates', error)
    throw error
  }

  const tally = new Map<
    string,
    Map<string, { count: number; state: string; stateCode: string }>
  >()
  for (const row of data ?? []) {
    const city = row.city?.trim()
    if (!city) continue
    const resolved = stateFromAddress(row.address)
    if (!resolved) continue
    const key = city.toLowerCase()
    const counts = tally.get(key) ?? new Map()
    const seen = counts.get(resolved.stateCode)
    counts.set(resolved.stateCode, {
      ...resolved,
      count: (seen?.count ?? 0) + 1,
    })
    tally.set(key, counts)
  }

  const byCity: Record<string, { state: string; stateCode: string }> = {}
  for (const [key, counts] of tally) {
    const winner = [...counts.values()].sort((a, b) => b.count - a.count)[0]
    byCity[key] = { state: winner.state, stateCode: winner.stateCode }
  }
  return byCity
})
