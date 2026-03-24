'use server'

import { revalidatePath } from 'next/cache'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BusinessRow {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  website: string | null
  website_clean: string | null
  review_count: number | null
  score: number | null
  category: string | null
  facebook_url: string | null
  instagram_url: string | null
  membership: Record<string, unknown> | null
  created_at: string | null
  updated_at: string | null
}

export interface BusinessSearchResult {
  business_id: number
  name: string | null
  address: string | null
  city: string | null
  category: string | null
  claim_status: 'unclaimed' | 'pending' | 'approved' | 'rejected'
}

interface SearchResult {
  success: boolean
  error?: string
  businesses?: BusinessSearchResult[]
}

interface SingleBusinessResult {
  success: boolean
  error?: string
  business?: BusinessRow
}

interface CreateBusinessResult {
  success: boolean
  error?: string
  businessId?: number
}

interface UpdateBusinessResult {
  success: boolean
  error?: string
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Search businesses by name. Returns claim status for each result by
 * checking if a business_profiles row exists for that business_id.
 */
export async function searchBusinessesAction(
  query: string,
  limit = 20,
): Promise<SearchResult> {
  try {
    if (!query.trim()) {
      return { success: true, businesses: [] }
    }

    const supabase = await createSupabaseServerClient()

    // Search master_business_info by name
    const { data: businesses, error } = await supabase
      .from('master_business_info')
      .select('business_id, name, address, city, category')
      .ilike('name', `%${query.trim()}%`)
      .order('name')
      .limit(limit)

    if (error) {
      return { success: false, error: error.message }
    }

    if (!businesses || businesses.length === 0) {
      return { success: true, businesses: [] }
    }

    // Check which businesses are claimed via business_claims table
    const businessIds = businesses.map((b) => b.business_id)
    const { data: claims } = await supabase
      .from('business_claims')
      .select('business_id, status')
      .in('business_id', businessIds)
      .in('status', ['pending', 'approved', 'code_sent'])

    const claimMap = new Map<number, string>()
    if (claims) {
      for (const claim of claims) {
        if (claim.business_id) {
          // Map business_claims.status to the BusinessSearchResult claim_status
          const mappedStatus =
            claim.status === 'code_sent' ? 'pending' : claim.status
          claimMap.set(claim.business_id, mappedStatus)
        }
      }
    }

    const results: BusinessSearchResult[] = businesses.map((b) => ({
      business_id: b.business_id,
      name: b.name,
      address: b.address,
      city: b.city,
      category: b.category,
      claim_status: (claimMap.get(b.business_id) as BusinessSearchResult['claim_status']) ?? 'unclaimed',
    }))

    return { success: true, businesses: results }
  } catch (error) {
    logger.error('searchBusinessesAction failed', {
      action: 'searchBusinessesAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get a single business by ID.
 */
export async function getBusinessByIdAction(
  businessId: number,
): Promise<SingleBusinessResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const { data, error } = await supabase
      .from('master_business_info')
      .select('*')
      .eq('business_id', businessId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return { success: false, error: 'Business not found.' }
      }
      return { success: false, error: error.message }
    }

    return { success: true, business: data as BusinessRow }
  } catch (error) {
    logger.error('getBusinessByIdAction failed', {
      action: 'getBusinessByIdAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Create a new business listing.
 * Requires authentication. Returns the new business_id.
 */
export async function createBusinessAction(data: {
  name: string
  address?: string
  city?: string
  website?: string
  category?: string
}): Promise<CreateBusinessResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data: business, error } = await supabase
      .from('master_business_info')
      .insert({
        name: stripHtml(data.name.trim()),
        address: data.address ? stripHtml(data.address.trim()) : null,
        city: data.city ? stripHtml(data.city.trim()) : null,
        website: data.website ? data.website.trim() : null,
        category: data.category ? stripHtml(data.category.trim()) : null,
      })
      .select('business_id')
      .single()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, businessId: business.business_id }
  } catch (error) {
    logger.error('createBusinessAction failed', {
      action: 'createBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Update an existing business listing.
 * Verifies the caller owns the business via business_profiles before updating.
 */
export async function updateBusinessAction(
  businessId: number,
  updates: {
    name?: string
    address?: string
    city?: string
    website?: string
    category?: string
  },
): Promise<UpdateBusinessResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Verify ownership via business_profiles
    const { data: profile, error: profileError } = await supabase
      .from('business_profiles')
      .select('business_id, claim_status')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return { success: false, error: 'Business profile not found.' }
    }

    if (profile.business_id !== businessId) {
      return { success: false, error: 'You do not own this business.' }
    }

    if (profile.claim_status !== 'approved') {
      return { success: false, error: 'Your business claim is not yet approved.' }
    }

    // Build sanitized update payload
    const payload: Record<string, string | null> = {}
    if (updates.name !== undefined) payload.name = stripHtml(updates.name.trim())
    if (updates.address !== undefined) payload.address = stripHtml(updates.address.trim())
    if (updates.city !== undefined) payload.city = stripHtml(updates.city.trim())
    if (updates.website !== undefined) payload.website = updates.website.trim() || null
    if (updates.category !== undefined) payload.category = stripHtml(updates.category.trim())

    if (Object.keys(payload).length === 0) {
      return { success: false, error: 'No valid fields to update.' }
    }

    const { error } = await supabase
      .from('master_business_info')
      .update(payload)
      .eq('business_id', businessId)

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard')

    return { success: true }
  } catch (error) {
    logger.error('updateBusinessAction failed', {
      action: 'updateBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Import a business from Google Places into master_business_info.
 * If the google_place_id already exists, returns the existing business_id.
 * Otherwise inserts a new row with all available Google data.
 */
export async function importGooglePlaceAction(place: {
  place_id: string
  name: string
  address: string
  city: string
  website: string | null
  rating: number | null
  review_count: number | null
  category: string | null
}): Promise<CreateBusinessResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Check if this Google place already exists in our DB
    const { data: existing } = await supabase
      .from('master_business_info')
      .select('business_id')
      .eq('google_place_id', place.place_id)
      .maybeSingle()

    if (existing) {
      return { success: true, businessId: existing.business_id }
    }

    // Insert new row with Google data
    const { data: business, error } = await supabase
      .from('master_business_info')
      .insert({
        name: place.name,
        address: place.address,
        city: place.city,
        website: place.website,
        score: place.rating,
        review_count: place.review_count,
        category: place.category,
        google_place_id: place.place_id,
      })
      .select('business_id')
      .single()

    if (error) {
      // Handle unique constraint on google_place_id (race condition)
      if (error.code === '23505') {
        const { data: raceResult } = await supabase
          .from('master_business_info')
          .select('business_id')
          .eq('google_place_id', place.place_id)
          .single()
        if (raceResult) {
          return { success: true, businessId: raceResult.business_id }
        }
      }
      return { success: false, error: error.message }
    }

    return { success: true, businessId: business.business_id }
  } catch (error) {
    logger.error('importGooglePlaceAction failed', {
      action: 'importGooglePlaceAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '')
}
