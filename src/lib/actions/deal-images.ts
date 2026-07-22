'use server'

import { revalidatePath } from 'next/cache'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

interface UploadResult {
  success: boolean
  error?: string
  url?: string
}

interface DeleteResult {
  success: boolean
  error?: string
}

/**
 * Upload a deal image to Supabase Storage.
 * Path convention: deal-images/{businessId}/{dealId}
 */
export async function uploadDealImageAction(
  dealId: number,
  businessId: number,
  formData: FormData,
): Promise<UploadResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const file = formData.get('image') as File
    if (!file) {
      return { success: false, error: 'No file provided' }
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Use JPEG, PNG, WebP, or AVIF.',
      }
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return { success: false, error: 'File too large. Maximum 5MB.' }
    }

    const path = `${businessId}/${dealId}`
    const { error } = await supabase.storage
      .from('deal-images')
      .upload(path, file, {
        upsert: true,
        contentType: file.type,
      })

    if (error) {
      return { success: false, error: error.message }
    }

    const { data: urlData } = supabase.storage
      .from('deal-images')
      .getPublicUrl(path)

    revalidatePath('/business/dashboard/deals')
    return { success: true, url: urlData.publicUrl }
  } catch (error) {
    logger.error('uploadDealImageAction failed', {
      action: 'uploadDealImageAction',
      dealId: String(dealId),
      businessId: String(businessId),
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Delete a deal image from Supabase Storage.
 */
export async function deleteDealImageAction(
  dealId: number,
  businessId: number,
): Promise<DeleteResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const path = `${businessId}/${dealId}`
    const { error } = await supabase.storage.from('deal-images').remove([path])

    if (error) {
      return { success: false, error: error.message }
    }

    revalidatePath('/business/dashboard/deals')
    return { success: true }
  } catch (error) {
    logger.error('deleteDealImageAction failed', {
      action: 'deleteDealImageAction',
      dealId: String(dealId),
      businessId: String(businessId),
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get the public URL for a deal image (no auth needed for public bucket).
 */
export async function getDealImageUrl(
  dealId: number,
  businessId: number,
): Promise<string> {
  const supabase = await createSupabaseServerClient()
  const path = `${businessId}/${dealId}`
  const { data } = supabase.storage.from('deal-images').getPublicUrl(path)
  return data.publicUrl
}
