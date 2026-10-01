'use server'

import { after } from 'next/server'
import {
  CLAIM_FEEDBACK_ANSWERS,
  CLAIM_FEEDBACK_LABELS,
  type ClaimFeedbackAnswer,
  cleanNote,
  DEAL_REPORT_REASON_LABELS,
  DEAL_REPORT_REASONS,
  type DealReportReason,
  isOfferId,
  isOneOf,
  isUuid,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'
import { sendOpsNotice } from '@/lib/email/opsInbox'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { callerIp, rateLimit, retryAfterPhrase } from '@/lib/rate-limit'
import { getSiteOrigin } from '@/lib/siteUrl'
import { createSupabaseServerClient } from '@/lib/supabase-server'

/**
 * "Report a problem" on a deal page, and "Did the clinic honor this price?" on a claim.
 * Both land in public.deal_reports (supabase/migrations/20260928010001_deal_reports.sql), whose
 * trigger and policies are the real boundary: every export here is a public HTTP endpoint, and
 * the anon key can insert a deal-page report without coming through here at all.
 */

export interface DealReportInput {
  offerId: number
  reason: DealReportReason
  /** Optional, up to 1,000 characters. */
  note?: string
}

export interface DealFeedbackResult {
  success: boolean
  error?: string
}

export interface ClaimFeedback {
  claimId: string
  answer: ClaimFeedbackAnswer
  note: string | null
  updatedAt: string
}

export interface ClaimFeedbackInput {
  claimId: string
  answer: ClaimFeedbackAnswer
  note?: string
}

export interface ClaimFeedbackResult {
  success: boolean
  error?: string
  feedback?: ClaimFeedback
}

interface ClaimFeedbackRow {
  claim_id: string
  reason: ClaimFeedbackAnswer
  note: string | null
  updated_at: string
}

const CLAIM_FEEDBACK_SELECT = 'claim_id, reason, note, updated_at'

function toFeedback(row: ClaimFeedbackRow): ClaimFeedback {
  return {
    claimId: row.claim_id,
    answer: row.reason,
    note: row.note,
    updatedAt: row.updated_at,
  }
}

function unexpected(
  action: string,
  error: unknown,
): { success: false; error: string } {
  logger.error(`${action} failed`, {
    action,
    error: error instanceof Error ? error.message : String(error),
  })
  return { success: false, error: 'Something went wrong. Please try again.' }
}

/**
 * Report a problem with a deal. Works signed out.
 *
 * Signed in, the reporter's id is recorded so an admin can follow up; signed out it is null,
 * which is the only shape the database lets anon insert. The row is not selected back: neither
 * role may read deal-page reports (a report can carry a reporter's id). That is safe because a
 * refused INSERT raises (42501, 23503, PT429) rather than resolving with zero rows.
 */
export async function submitDealReportAction(
  input: DealReportInput,
): Promise<DealFeedbackResult> {
  try {
    // Same budget as the listing-request form. The database also caps deal-page reports at 300
    // a day, for callers who skip this action.
    const limit = rateLimit(`deal-report:${await callerIp()}`, 5, 10 * 60_000)
    if (!limit.allowed) {
      return {
        success: false,
        error: `You've sent several reports already. ${retryAfterPhrase(limit.retryAfterSeconds)}`,
      }
    }

    if (!isOfferId(input?.offerId)) {
      return {
        success: false,
        error:
          "We couldn't tell which deal this is about. Refresh the page and try again.",
      }
    }
    if (!isOneOf(DEAL_REPORT_REASONS, input.reason)) {
      return { success: false, error: "Please choose what's wrong." }
    }
    const note = cleanNote(input.note, NOTE_MAX.report) || null

    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase.from('deal_reports').insert({
      offer_id: input.offerId,
      source: 'deal_page',
      reason: input.reason,
      note,
      reporter_id: user?.id ?? null,
    })
    if (error) {
      logSupabaseError('submitDealReportAction', error, {
        offerId: input.offerId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't send your report. Please try again.",
        ),
      }
    }

    const offerId = input.offerId
    const reason = input.reason
    after(() =>
      notifyOps(
        `Deal report: ${DEAL_REPORT_REASON_LABELS[reason]} (deal ${offerId})`,
        'Someone reported a problem with a deal. It is saved in public.deal_reports.',
        [
          ['Deal', `${getSiteOrigin()}/deals/${offerId}`],
          ['Problem', DEAL_REPORT_REASON_LABELS[reason]],
          ['Note', note ?? '(none)'],
          ['Reporter', user ? `signed-in user ${user.id}` : 'signed out'],
        ],
        'submitDealReportAction',
      ),
    )

    return { success: true }
  } catch (error) {
    return unexpected('submitDealReportAction', error)
  }
}

/**
 * Answer "Did the clinic honor this price?" for one of the caller's own claims. One answer per
 * claim (UNIQUE claim_id); answering again replaces it and reopens it for the admin.
 *
 * The claim is checked here against the caller's own claims, and again by the INSERT policy;
 * the deal the answer is about is taken from the claim by the database, never from the client.
 */
export async function submitClaimFeedbackAction(
  input: ClaimFeedbackInput,
): Promise<ClaimFeedbackResult> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: 'Your session has expired. Please sign in again.',
      }
    }

    const limit = rateLimit(`claim-feedback:${user.id}`, 10, 10 * 60_000)
    if (!limit.allowed) {
      return {
        success: false,
        error: `You've changed this several times already. ${retryAfterPhrase(limit.retryAfterSeconds)}`,
      }
    }

    if (!isUuid(input?.claimId)) {
      return { success: false, error: "We couldn't find that claim." }
    }
    if (!isOneOf(CLAIM_FEEDBACK_ANSWERS, input.answer)) {
      return { success: false, error: 'Please choose an answer.' }
    }
    const note = cleanNote(input.note, NOTE_MAX.report) || null

    const { data: claim, error: claimError } = await supabase
      .from('claims')
      .select('id, deal_id')
      .eq('id', input.claimId)
      .eq('consumer_id', user.id)
      .maybeSingle()
    if (claimError) {
      logSupabaseError('submitClaimFeedbackAction.claim', claimError, {
        claimId: input.claimId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          claimError,
          "We couldn't save your answer. Please try again.",
        ),
      }
    }
    if (!claim) {
      return { success: false, error: "We couldn't find that claim." }
    }

    // Upsert on the one-per-claim key. offer_id, reporter_id and status are not sent: the
    // trigger takes them from the claim and the session, and resets status to open.
    const { data, error } = await supabase
      .from('deal_reports')
      .upsert(
        {
          claim_id: input.claimId,
          source: 'claim',
          reason: input.answer,
          note,
        },
        { onConflict: 'claim_id' },
      )
      .select(CLAIM_FEEDBACK_SELECT)
      .maybeSingle()
    if (error) {
      logSupabaseError('submitClaimFeedbackAction', error, {
        claimId: input.claimId,
      })
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't save your answer. Please try again.",
        ),
      }
    }
    if (!data) {
      logger.error('Claim feedback upsert returned no row', {
        action: 'submitClaimFeedbackAction',
        claimId: input.claimId,
      })
      return {
        success: false,
        error: "We couldn't save your answer. Please try again.",
      }
    }

    const feedback = toFeedback(data as ClaimFeedbackRow)
    // A clinic that would not honor a price is what the admin most needs to hear about.
    if (feedback.answer !== 'honored') {
      const dealId = (claim as { deal_id: number }).deal_id
      after(() =>
        notifyOps(
          `Claim answer: ${CLAIM_FEEDBACK_LABELS[feedback.answer]} (deal ${dealId})`,
          'A customer answered "Did the clinic honor this price?". It is saved in public.deal_reports.',
          [
            ['Answer', CLAIM_FEEDBACK_LABELS[feedback.answer]],
            ['Deal', `${getSiteOrigin()}/deals/${dealId}`],
            ['Claim', feedback.claimId],
            ['Note', feedback.note ?? '(none)'],
          ],
          'submitClaimFeedbackAction',
        ),
      )
    }

    return { success: true, feedback }
  } catch (error) {
    return unexpected('submitClaimFeedbackAction', error)
  }
}

/** The caller's answers to "Did the clinic honor this price?", one per claim answered. */
export async function getMyClaimFeedbackAction(): Promise<{
  success: boolean
  error?: string
  feedback?: ClaimFeedback[]
}> {
  try {
    const supabase = await createSupabaseServerClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return {
        success: false,
        error: 'Your session has expired. Please sign in again.',
      }
    }

    const { data, error } = await supabase
      .from('deal_reports')
      .select(CLAIM_FEEDBACK_SELECT)
      .eq('source', 'claim')
      .eq('reporter_id', user.id)
    if (error) {
      logSupabaseError('getMyClaimFeedbackAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load your answers."),
      }
    }
    return {
      success: true,
      feedback: ((data ?? []) as ClaimFeedbackRow[]).map(toFeedback),
    }
  } catch (error) {
    return unexpected('getMyClaimFeedbackAction', error)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * No admin screen is watched in real time, so without this a report sits where nobody looks.
 * Best-effort, after the response: the row is already saved, and sendEmail logs its own failure.
 */
async function notifyOps(
  subject: string,
  intro: string,
  rows: [string, string][],
  action: string,
): Promise<void> {
  const result = await sendOpsNotice(subject, intro, rows, action)
  if (!result.success) {
    logger.error('Deal feedback saved but the ops notice did not send', {
      action,
      error: result.error,
    })
  }
}
