'use server'

import { sendEmailAction } from '@/lib/actions/notifications'
import { buildEmailHtml } from '@/lib/email/templates'
import { logger } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActionResult {
  success: boolean
  error?: string
}

interface CreateClaimResult extends ActionResult {
  claimId?: string
}

interface ClaimResult extends ActionResult {
  claim?: Record<string, unknown>
}

interface ClaimsListResult extends ActionResult {
  claims?: Record<string, unknown>[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Create a new business claim and send verification code via email.
 */
export async function createBusinessClaimAction(
  businessId: number | string,
  verificationMethod: 'email' | 'document',
): Promise<CreateClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Verify user is authenticated and has business role
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const role = user.user_metadata?.role as string | undefined
    if (role !== 'business') {
      return {
        success: false,
        error: 'Only business accounts can claim a business.',
      }
    }

    const numericBusinessId = Number(businessId)
    if (Number.isNaN(numericBusinessId)) {
      return { success: false, error: 'Invalid business ID.' }
    }

    // 2. Check no existing pending/approved claim on this business
    const { data: existingClaim } = await supabase
      .from('business_claims')
      .select('id, status')
      .eq('business_id', numericBusinessId)
      .in('status', ['pending', 'approved', 'code_sent'])
      .maybeSingle()

    if (existingClaim) {
      if (existingClaim.status === 'approved') {
        return {
          success: false,
          error: 'This business has already been claimed.',
        }
      }
      return {
        success: false,
        error: 'A pending claim already exists for this business.',
      }
    }

    // 3. Verify the business exists
    const { data: business, error: bizError } = await supabase
      .from('master_business_info')
      .select('business_id')
      .eq('business_id', numericBusinessId)
      .single()

    if (bizError || !business) {
      return { success: false, error: 'Business not found.' }
    }

    // 4. Insert into business_claims
    const { data: claim, error: insertError } = await supabase
      .from('business_claims')
      .insert({
        profile_id: user.id,
        business_id: numericBusinessId,
        verification_method: verificationMethod,
        status: 'code_sent',
        verification_attempts: 0,
      })
      .select('id')
      .single()

    if (insertError) {
      return { success: false, error: insertError.message }
    }

    // 5. If method is 'email', send verification code
    if (verificationMethod === 'email') {
      const sendResult = await sendVerificationCodeAction(claim.id)
      if (!sendResult.success) {
        return { success: false, error: sendResult.error, claimId: claim.id }
      }
    }

    return { success: true, claimId: claim.id }
  } catch (error) {
    logger.error('createBusinessClaimAction failed', {
      action: 'createBusinessClaimAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Generate and send a 6-digit verification code via email.
 */
export async function sendVerificationCodeAction(
  claimId: string,
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // 2. Fetch claim and verify ownership
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('id, profile_id, business_id')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      return { success: false, error: 'Claim not found.' }
    }

    if (claim.profile_id !== user.id) {
      return { success: false, error: 'Not authorized for this claim.' }
    }

    // 3. Determine email address — use claimant's email
    const recipientEmail = user.email
    if (!recipientEmail) {
      return {
        success: false,
        error: 'No email address found for your account.',
      }
    }

    // 4. Generate 6-digit code
    const code = generateVerificationCode()

    // 5. Store code with 10-minute expiry
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    const { error: updateError } = await supabase
      .from('business_claims')
      .update({
        verification_code: code,
        verification_code_expires_at: expiresAt,
        verification_attempts: 0,
      })
      .eq('id', claimId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    // 6. Send email via sendEmailAction
    const html = buildEmailHtml({
      title: 'Business Verification Code',
      bodyHtml: `
        <p style="margin: 0 0 12px 0;">Hi ${user.user_metadata?.first_name ?? 'there'},</p>
        <p style="margin: 0 0 16px 0;">
          Use the following code to verify your business claim on CostFinders:
        </p>
        <div style="margin: 16px 0; padding: 16px 24px; background-color: #fef3c7; border-radius: 8px; text-align: center;">
          <span style="font-size: 32px; font-weight: 700; letter-spacing: 6px; color: #451a03;">${code}</span>
        </div>
        <p style="margin: 16px 0 0 0; font-size: 13px; color: #78716c;">
          This code expires in 10 minutes. If you didn&rsquo;t request this, you can safely ignore this email.
        </p>`,
    })

    const emailResult = await sendEmailAction(
      recipientEmail,
      'Your CostFinders verification code',
      html,
    )

    if (!emailResult.success) {
      return { success: false, error: 'Failed to send verification email.' }
    }

    return { success: true }
  } catch (error) {
    logger.error('sendVerificationCodeAction failed', {
      action: 'sendVerificationCodeAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Verify the 6-digit code submitted by the business owner.
 */
export async function verifyCodeAction(
  claimId: string,
  code: string,
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // 2. Fetch claim
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select(
        'id, profile_id, verification_code, verification_code_expires_at, verification_attempts',
      )
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      return { success: false, error: 'Claim not found.' }
    }

    if (claim.profile_id !== user.id) {
      return { success: false, error: 'Not authorized for this claim.' }
    }

    // 3. Check verification_attempts < 3
    if ((claim.verification_attempts ?? 0) >= 3) {
      return {
        success: false,
        error:
          'Too many failed attempts. Please request a new verification code.',
      }
    }

    // 4. Check code hasn't expired
    if (
      !claim.verification_code_expires_at ||
      new Date(claim.verification_code_expires_at) < new Date()
    ) {
      return {
        success: false,
        error: 'Verification code has expired. Please request a new one.',
      }
    }

    // 5. Compare code
    if (code.trim() !== claim.verification_code) {
      // Increment verification_attempts
      await supabase
        .from('business_claims')
        .update({
          verification_attempts: (claim.verification_attempts ?? 0) + 1,
        })
        .eq('id', claimId)

      const attemptsLeft = 2 - (claim.verification_attempts ?? 0)
      return {
        success: false,
        error:
          attemptsLeft > 0
            ? `Invalid code. ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining.`
            : 'Invalid code. No attempts remaining. Please request a new code.',
      }
    }

    // 6. Code matches — update status to 'pending' (awaiting admin review)
    const { error: updateError } = await supabase
      .from('business_claims')
      .update({
        status: 'pending',
        verification_code: null,
        verification_code_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('verifyCodeAction failed', {
      action: 'verifyCodeAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Upload a verification document for a claim.
 */
export async function uploadVerificationDocAction(
  claimId: string,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const supabase = await createSupabaseServerClient()

    // 1. Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // 2. Fetch claim and verify ownership
    const { data: claim, error: claimError } = await supabase
      .from('business_claims')
      .select('id, profile_id')
      .eq('id', claimId)
      .single()

    if (claimError || !claim) {
      return { success: false, error: 'Claim not found.' }
    }

    if (claim.profile_id !== user.id) {
      return { success: false, error: 'Not authorized for this claim.' }
    }

    // 3. Validate file
    const file = formData.get('file') as File | null
    if (!file) {
      return { success: false, error: 'No file provided.' }
    }

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png']
    if (!allowedTypes.includes(file.type)) {
      return {
        success: false,
        error: 'Invalid file type. Only PDF, JPG, and PNG files are accepted.',
      }
    }

    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return {
        success: false,
        error: 'File is too large. Maximum size is 5MB.',
      }
    }

    // 4. Upload to Supabase Storage
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'pdf'
    const storagePath = `${user.id}/${claimId}.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('claim-verification-docs')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      return { success: false, error: `Upload failed: ${uploadError.message}` }
    }

    // 5. Get public URL
    const { data: urlData } = supabase.storage
      .from('claim-verification-docs')
      .getPublicUrl(storagePath)

    // 6. Update business_claims with document URL and status
    const { error: updateError } = await supabase
      .from('business_claims')
      .update({
        evidence_document_url: urlData.publicUrl,
        status: 'pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', claimId)

    if (updateError) {
      return { success: false, error: updateError.message }
    }

    return { success: true }
  } catch (error) {
    logger.error('uploadVerificationDocAction failed', {
      action: 'uploadVerificationDocAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get claim status for a specific business.
 * Fetches the most recent claim where status is pending or approved.
 */
export async function getClaimForBusinessAction(
  businessId: number,
): Promise<ClaimResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('business_claims')
      .select('*')
      .eq('business_id', businessId)
      .in('status', ['pending', 'approved', 'code_sent'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, claim: data as Record<string, unknown> | undefined }
  } catch (error) {
    logger.error('getClaimForBusinessAction failed', {
      action: 'getClaimForBusinessAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

/**
 * Get all claims for the current user.
 */
export async function getMyClaimsAction(): Promise<ClaimsListResult> {
  try {
    const supabase = await createSupabaseServerClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    const { data, error } = await supabase
      .from('business_claims')
      .select(
        `
        *,
        master_business_info (
          name,
          city,
          address,
          category
        )
      `,
      )
      .eq('profile_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      return { success: false, error: error.message }
    }

    return {
      success: true,
      claims: (data ?? []) as Record<string, unknown>[],
    }
  } catch (error) {
    logger.error('getMyClaimsAction failed', {
      action: 'getMyClaimsAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
