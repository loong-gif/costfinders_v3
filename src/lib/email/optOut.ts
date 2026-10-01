/**
 * Email opt-out lookup for outbound mail.
 *
 * `profiles.alerts_email` has been written by the settings screen since it shipped and
 * read by ZERO senders, so unchecking "Email notifications" changed nothing. This is the
 * missing half. It belongs here rather than at each `sendEmail()` call site because a
 * guard in the shared sender is the only version that cannot be forgotten by the next
 * caller.
 *
 * Keyed by USER ID, never by address. The first version asked `email_prefs_for_address`,
 * which answers "does this address have an account" for whoever calls it — so live EXECUTE
 * had to be pulled back to postgres only, every lookup then failed, failed open, and every
 * email shipped an untokenised unsubscribe link. `email_preferences_for_user` (migration
 * 20260924040002) takes a uuid instead, which only a counterparty already holds.
 *
 * Deliberately NOT a Server Action: every export of a `'use server'` module is a public
 * HTTP endpoint.
 */

import { logger } from '@/lib/logger'
import { getSiteOrigin } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/** Untokenised fallback. Real page, explains how to opt out; no one-click. */
export const UNSUBSCRIBE_URL = `${getSiteOrigin()}/unsubscribe`

export interface RecipientEmailPrefs {
  /** True only when the recipient's profile has alerts_email = false. */
  suppressed: boolean
  /** Tokenised one-click opt-out URL, or the generic page when the recipient is unknown. */
  unsubscribeUrl: string
  /**
   * The account the mail is going to, or null when it could not be resolved — an ops
   * inbox, or a call site that did not pass `recipientUserId` for someone other than the
   * signed-in caller. Null means the opt-out was NOT checked.
   */
  userId: string | null
}

/**
 * Look up a recipient's email preference and their opt-out link.
 *
 * Who the recipient is: `recipientUserId` when the caller passes it, otherwise the
 * signed-in caller if their address is the one being mailed (a claim receipt, a
 * verification code). Nothing else — resolving an arbitrary address to an account is
 * exactly the oracle this replaced.
 *
 * FAILS OPEN. A lookup that errors returns `suppressed: false`, because the failure mode
 * of the other choice is silently swallowing claim confirmations and deal-moderation
 * notices — the "reports success, sends nothing" bug this codebase already fixed twice.
 */
export async function getRecipientEmailPrefs(
  to: string,
  recipientUserId?: string,
): Promise<RecipientEmailPrefs> {
  let userId = recipientUserId ?? null
  try {
    const supabase = await createSupabaseServerClient()

    if (!userId) {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user?.email?.toLowerCase() === to.trim().toLowerCase()) {
        userId = user.id
      }
    }
    if (!userId) {
      return { suppressed: false, unsubscribeUrl: UNSUBSCRIBE_URL, userId }
    }

    const { data, error } = await supabase.rpc('email_preferences_for_user', {
      p_user_id: userId,
    })

    if (error) {
      // warn, not error: this is a degraded lookup, not a failed send, and routing it
      // through logger.error would page on something that has not lost any mail.
      logger.warn('Email preference lookup failed — treating as opted in', {
        action: 'getRecipientEmailPrefs',
        userId,
        code: error.code,
      })
      return { suppressed: false, unsubscribeUrl: UNSUBSCRIBE_URL, userId }
    }

    const row = (Array.isArray(data) ? data[0] : data) as {
      email_opt_out: boolean
      unsubscribe_token: string | null
    } | null

    return {
      suppressed: row?.email_opt_out === true,
      unsubscribeUrl: row?.unsubscribe_token
        ? `${UNSUBSCRIBE_URL}?token=${encodeURIComponent(row.unsubscribe_token)}`
        : UNSUBSCRIBE_URL,
      userId,
    }
  } catch (error) {
    logger.warn('Email preference lookup threw — treating as opted in', {
      action: 'getRecipientEmailPrefs',
      error: error instanceof Error ? error.message : String(error),
    })
    return { suppressed: false, unsubscribeUrl: UNSUBSCRIBE_URL, userId }
  }
}

/**
 * RFC 8058 one-click headers for a Resend send.
 *
 * `List-Unsubscribe-Post` is what makes Gmail and Yahoo render their own native
 * "Unsubscribe" affordance and POST to the URL without the recipient ever loading a
 * page. Emitted only for a tokenised URL — a header pointing at the generic page would
 * have the provider POST a request that cannot identify anyone.
 */
export function listUnsubscribeHeaders(
  unsubscribeUrl: string,
): Record<string, string> {
  if (!unsubscribeUrl.includes('token=')) return {}
  const oneClick = unsubscribeUrl.replace(
    '/unsubscribe?',
    '/unsubscribe/confirm?',
  )
  return {
    'List-Unsubscribe': `<${oneClick}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

/**
 * Mail that must go out even to someone who has turned email notifications off.
 *
 * The settings toggle reads "Receive deal alerts and claim updates via email", so claim
 * and deal-moderation notices are genuinely in scope for it. A one-time credential the
 * user just asked for is not: suppressing the business-ownership code would leave anyone
 * who had opted out unable to finish the claim funnel at all, with no error to explain it.
 *
 * ponytail: matched on the subject line, which is a string and therefore fragile. The
 * explicit `essential: true` option on sendEmail() now exists and wins; this list is the
 * fallback for call sites that have not passed it yet. Once every essential sender passes
 * the flag, delete this list. tests/unit/emailCompliance.test.ts pins the live subject
 * strings so a rename fails the suite instead of the funnel.
 */
const ESSENTIAL_SUBJECTS: readonly RegExp[] = [
  /verification code/i, // src/lib/actions/business-verification.ts — ownership code
  /reset your password/i, // Supabase Auth templates, if they ever route through here
  /confirm your email/i,
  /magic link/i,
  // src/lib/email/claimNotification.ts — internal lead notice to CLAIM_NOTIFICATION_EMAIL,
  // not to a subscriber. It routes through sendEmail() like everything else, so without this
  // an operator address that also holds a consumer account with notifications off would
  // silently stop receiving leads. The toggle is a user preference; this is ops mail.
  /^new claim:/i,
]

export function isEssentialEmail(subject: string): boolean {
  return ESSENTIAL_SUBJECTS.some((pattern) => pattern.test(subject))
}
