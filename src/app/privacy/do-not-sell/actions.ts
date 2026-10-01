'use server'

import { sendOpsNotice } from '@/lib/email/opsInbox'
import { logger } from '@/lib/logger'
import { callerIp, rateLimit, retryAfterPhrase } from '@/lib/rate-limit'

/**
 * "Do Not Sell or Share My Personal Information" requests. Public by design: anyone may opt
 * out, signed in or not, so validation and the rate limit are the whole trust boundary.
 *
 * ponytail: no table. The email to the ops inbox IS the record, so the send is awaited and a
 * failure is told to the requester rather than shown as a success they would rely on. Add a
 * table when requests need an admin screen or proof of handling beyond that mailbox.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function clean(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value
        .replace(/<[^>]*>/g, '')
        .trim()
        .slice(0, max)
    : ''
}

export async function submitDoNotSellAction(input: {
  email: string
  message?: string
}): Promise<{ success: boolean; error?: string }> {
  try {
    const limit = rateLimit(`do-not-sell:${await callerIp()}`, 5, 10 * 60_000)
    if (!limit.allowed) {
      return {
        success: false,
        error: `You've sent several requests already. ${retryAfterPhrase(limit.retryAfterSeconds)}`,
      }
    }

    const email = clean(input?.email, 254)
    const message = clean(input?.message, 2000)
    if (!EMAIL_RE.test(email)) {
      return { success: false, error: 'Please enter a valid email address.' }
    }

    const result = await sendOpsNotice(
      'Privacy request: do not sell or share',
      'Someone asked us not to sell or share their personal information. Keep this email: it is the only record of the request.',
      [
        ['Email', email],
        ['Message', message || '(none)'],
        ['Received', new Date().toISOString()],
      ],
      'submitDoNotSellAction',
    )
    if (!result.success) {
      return {
        success: false,
        error:
          "We couldn't send your request. Please try again, or email support@costfinders.ai.",
      }
    }
    return { success: true }
  } catch (error) {
    logger.error('submitDoNotSellAction failed', {
      action: 'submitDoNotSellAction',
      error: error instanceof Error ? error.message : String(error),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}
