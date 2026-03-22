import { cache } from 'react'
import { supabase } from '@/lib/supabase'
import type { Business } from '@/types/supabase'

const TABLE = 'master_business_info'

export const getBusinesses = cache(async function getBusinesses(city?: string): Promise<Business[]> {
  let query = supabase
    .from(TABLE)
    .select(
      'business_id, name, address, city, website_clean, review_count, score, category, facebook_url, instagram_url, created_at, updated_at',
    )
    .order('score', { ascending: false, nullsFirst: false })

  if (city) {
    query = query.ilike('city', city)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as Business[]
})

export const getBusinessById = cache(async function getBusinessById(id: number): Promise<Business | null> {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .eq('business_id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as Business
})

export const getBusinessCities = cache(async function getBusinessCities(): Promise<
  { city: string; count: number }[]
> {
  const { data, error } = await supabase.rpc('get_business_cities')

  // Fallback: if the RPC doesn't exist, query manually
  if (error) {
    const { data: raw, error: rawError } = await supabase
      .from(TABLE)
      .select('city')

    if (rawError) throw rawError

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
})

export async function getBusinessCategories(): Promise<
  { category: string; count: number }[]
> {
  const { data, error } = await supabase.from(TABLE).select('category')

  if (error) throw error

  const counts = new Map<string, number>()
  for (const row of data ?? []) {
    if (!row.category) continue
    counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)
}

export async function searchBusinesses(query: string): Promise<Business[]> {
  const { data, error } = await supabase
    .from(TABLE)
    .select(
      'business_id, name, address, city, website_clean, review_count, score, category',
    )
    .or(`name.ilike.%${query}%,address.ilike.%${query}%`)
    .order('score', { ascending: false, nullsFirst: false })
    .limit(20)

  if (error) throw error
  return (data ?? []) as Business[]
}
