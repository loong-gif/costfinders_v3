'use server'

import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/actions/audit'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ContentCategory {
  id: string
  name: string
  slug: string
  display_order: number
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ContentLocation {
  id: string
  city: string
  state: string
  state_code: string
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ActionResult {
  success: boolean
  error?: string
}

interface CategoriesResult extends ActionResult {
  categories?: ContentCategory[]
}

interface LocationsResult extends ActionResult {
  locations?: ContentLocation[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function verifyAdmin() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  const role = user.user_metadata?.role as string | undefined
  if (role !== 'admin') {
    throw new Error('Unauthorized: admin access required')
  }

  return { supabase, user }
}

const CONTENT_PATH = '/admin/dashboard/content'

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function getCategoriesAction(): Promise<CategoriesResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { data, error } = await supabase
      .from('content_categories')
      .select('*')
      .order('display_order', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, categories: (data ?? []) as ContentCategory[] }
  } catch (err) {
    logger.error('getCategoriesAction failed', {
      action: 'getCategoriesAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function createCategoryAction(
  name: string,
  slug: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    // Get the next display order
    const { data: existing } = await supabase
      .from('content_categories')
      .select('display_order')
      .order('display_order', { ascending: false })
      .limit(1)

    const nextOrder =
      existing && existing.length > 0
        ? (existing[0].display_order as number) + 1
        : 1

    const { error } = await supabase.from('content_categories').insert({
      name,
      slug,
      display_order: nextOrder,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('category_created', 'content_category', undefined, {
      name,
      slug,
    })
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('createCategoryAction failed', {
      action: 'createCategoryAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function updateCategoryAction(
  id: string,
  updates: { name?: string; slug?: string; display_order?: number },
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('content_categories')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('category_updated', 'content_category', id, updates)
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('updateCategoryAction failed', {
      action: 'updateCategoryAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function toggleCategoryAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('content_categories')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('category_toggled', 'content_category', id, {
      is_active: isActive,
    })
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('toggleCategoryAction failed', {
      action: 'toggleCategoryAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

// ---------------------------------------------------------------------------
// Locations
// ---------------------------------------------------------------------------

export async function getLocationsAction(): Promise<LocationsResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { data, error } = await supabase
      .from('content_locations')
      .select('*')
      .order('state', { ascending: true })
      .order('city', { ascending: true })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, locations: (data ?? []) as ContentLocation[] }
  } catch (err) {
    logger.error('getLocationsAction failed', {
      action: 'getLocationsAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function createLocationAction(
  city: string,
  state: string,
  stateCode: string,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase.from('content_locations').insert({
      city,
      state,
      state_code: stateCode,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('location_created', 'content_location', undefined, {
      city,
      state,
      stateCode,
    })
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('createLocationAction failed', {
      action: 'createLocationAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function updateLocationAction(
  id: string,
  updates: { city?: string; state?: string; state_code?: string },
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('content_locations')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('location_updated', 'content_location', id, updates)
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('updateLocationAction failed', {
      action: 'updateLocationAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}

export async function toggleLocationAction(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  try {
    const { supabase } = await verifyAdmin()

    const { error } = await supabase
      .from('content_locations')
      .update({
        is_active: isActive,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) {
      return { success: false, error: error.message }
    }

    await logAdminAction('location_toggled', 'content_location', id, {
      is_active: isActive,
    })
    revalidatePath(CONTENT_PATH)
    return { success: true }
  } catch (err) {
    logger.error('toggleLocationAction failed', {
      action: 'toggleLocationAction',
      error: err instanceof Error ? err.message : String(err),
    })
    const message =
      err instanceof Error ? err.message : 'An unexpected error occurred.'
    return { success: false, error: message }
  }
}
