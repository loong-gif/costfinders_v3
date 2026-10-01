'use server'

import { revalidatePath } from 'next/cache'
import { logAdminAction } from '@/lib/actions/audit'
import {
  CLAIM_FEEDBACK_LABELS,
  type ClaimFeedbackAnswer,
  cleanNote,
  DEAL_REPORT_REASON_LABELS,
  type DealReportReason,
  FEEDBACK_STATUSES,
  type FeedbackStatus,
  isOneOf,
  isUuid,
  NOTE_MAX,
} from '@/lib/actions/deal-feedback-rules'
import { requireAdmin } from '@/lib/auth/guards'
import { OFFER_TITLE_SELECT, resolveOfferTitle } from '@/lib/data/offers'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'

/**
 * The admin queue for deal reports, claim answers and owners' correction requests.
 *
 * requireAdmin() (public.is_admin() against admin_profiles) authorizes every export, and the
 * tables' own policies (private.is_admin()) authorize again. Corrections are applied by hand in
 * the existing deal editor; this only records what was decided. Every write is selected back and
 * audit-logged.
 */

export interface AdminDealReport {
  id: string
  offerId: number | null
  offerTitle: string | null
  source: 'deal_page' | 'claim'
  reason: DealReportReason | ClaimFeedbackAnswer
  /** The reason in the words the reporter chose it from. */
  reasonLabel: string
  note: string | null
  status: FeedbackStatus
  adminNote: string | null
  claimId: string | null
  reporterId: string | null
  createdAt: string
  /** Moves when a customer changes a claim answer. */
  updatedAt: string
  resolvedAt: string | null
}

export interface OfferSnapshot {
  discountPrice: number | null
  regularPrice: number | null
  discountPercent: number | null
  discountAmount: number | null
  priceModel: string | null
}

export interface AdminOfferCorrection {
  id: string
  offerId: number | null
  offerTitle: string | null
  businessId: number | null
  businessName: string | null
  note: string
  status: FeedbackStatus
  adminNote: string | null
  createdAt: string
  resolvedAt: string | null
  /** The deal's prices when the owner wrote this, as the database captured them. */
  snapshot: OfferSnapshot
}

export interface AdminFeedbackResult {
  success: boolean
  error?: string
}

/** 'all', or one status. The queue opens on 'open'. */
export type FeedbackStatusFilter = FeedbackStatus | 'all'

type OfferTitleRow = Parameters<typeof resolveOfferTitle>[0]

interface ReportRow {
  id: string
  offer_id: number | null
  source: 'deal_page' | 'claim'
  reason: DealReportReason | ClaimFeedbackAnswer
  note: string | null
  status: FeedbackStatus
  claim_id: string | null
  reporter_id: string | null
  created_at: string
  updated_at: string
  resolved_at: string | null
  promo_offer_master: OfferTitleRow | null
}

interface CorrectionRow {
  id: string
  offer_id: number | null
  business_id: number | null
  note: string | null
  status: FeedbackStatus
  created_at: string
  resolved_at: string | null
  snapshot: Record<string, unknown> | null
  promo_offer_master: OfferTitleRow | null
  master_business_info: { name: string | null } | null
}

const QUEUE_LIMIT = 200

function reasonLabel(row: Pick<ReportRow, 'source' | 'reason'>): string {
  return row.source === 'claim'
    ? `Honored? ${CLAIM_FEEDBACK_LABELS[row.reason as ClaimFeedbackAnswer] ?? row.reason}`
    : (DEAL_REPORT_REASON_LABELS[row.reason as DealReportReason] ?? row.reason)
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' ? value : null
}

function failure(action: string, error: unknown): AdminFeedbackResult {
  logger.error(`${action} failed`, {
    action,
    error: error instanceof Error ? error.message : String(error),
  })
  return {
    success: false,
    // requireAdmin() throws "Not authenticated" / "Unauthorized: admin access required".
    error:
      error instanceof Error
        ? error.message
        : 'Something went wrong. Please try again.',
  }
}

function parseFilter(value: unknown): FeedbackStatusFilter | null {
  if (value === undefined || value === 'all') return 'all'
  return isOneOf(FEEDBACK_STATUSES, value) ? value : null
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

/**
 * The admin notes on these rows, by id. `admin_note` is not granted to `authenticated`
 * (20260928010003): as a plain column the clinic's owner and the customer could read the note
 * about them through their own SELECT policies. admin_feedback_notes() returns it to admins only.
 * A failed read fails the queue: the note box starts from the current note, so a queue loaded
 * without its notes would erase every one it resolved.
 */
async function adminNotes(
  supabase: AdminClient,
  ids: string[],
  action: string,
): Promise<Map<string, string | null> | null> {
  if (ids.length === 0) return new Map()
  const { data, error } = await supabase.rpc('admin_feedback_notes', {
    p_ids: ids,
  })
  if (error) {
    logSupabaseError(action, error)
    return null
  }
  return new Map(
    ((data ?? []) as { id: string; admin_note: string | null }[]).map((row) => [
      row.id,
      row.admin_note,
    ]),
  )
}

/** Deal-page reports and claim answers, newest first. */
export async function getDealReportsAction(
  status: FeedbackStatusFilter = 'open',
): Promise<AdminFeedbackResult & { reports?: AdminDealReport[] }> {
  try {
    const { supabase } = await requireAdmin()
    const filter = parseFilter(status)
    if (!filter)
      return { success: false, error: 'Pick a status from the list.' }

    let query = supabase
      .from('deal_reports')
      .select(
        `id, offer_id, source, reason, note, status, claim_id, reporter_id,
         created_at, updated_at, resolved_at, promo_offer_master(${OFFER_TITLE_SELECT})`,
      )
      .order('created_at', { ascending: false })
      .limit(QUEUE_LIMIT)
    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) {
      logSupabaseError('getDealReportsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load deal reports."),
      }
    }
    const rows = (data ?? []) as unknown as ReportRow[]
    const notes = await adminNotes(
      supabase,
      rows.map((row) => row.id),
      'getDealReportsAction',
    )
    if (!notes) {
      return { success: false, error: "We couldn't load deal reports." }
    }

    return {
      success: true,
      reports: rows.map((row) => ({
        id: row.id,
        offerId: row.offer_id,
        offerTitle: row.promo_offer_master
          ? resolveOfferTitle(row.promo_offer_master)
          : null,
        source: row.source,
        reason: row.reason,
        reasonLabel: reasonLabel(row),
        note: row.note,
        status: row.status,
        adminNote: notes.get(row.id) ?? null,
        claimId: row.claim_id,
        reporterId: row.reporter_id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        resolvedAt: row.resolved_at,
      })),
    }
  } catch (error) {
    return failure('getDealReportsAction', error)
  }
}

/** Owners' correction requests, newest first. Confirmations are not a queue and are left out. */
export async function getOfferCorrectionsAction(
  status: FeedbackStatusFilter = 'open',
): Promise<AdminFeedbackResult & { corrections?: AdminOfferCorrection[] }> {
  try {
    const { supabase } = await requireAdmin()
    const filter = parseFilter(status)
    if (!filter)
      return { success: false, error: 'Pick a status from the list.' }

    let query = supabase
      .from('offer_confirmations')
      .select(
        `id, offer_id, business_id, note, status, created_at, resolved_at, snapshot,
         promo_offer_master(${OFFER_TITLE_SELECT}), master_business_info(name)`,
      )
      .eq('kind', 'correction')
      .order('created_at', { ascending: false })
      .limit(QUEUE_LIMIT)
    if (filter !== 'all') query = query.eq('status', filter)

    const { data, error } = await query
    if (error) {
      logSupabaseError('getOfferCorrectionsAction', error)
      return {
        success: false,
        error: publicErrorMessage(
          error,
          "We couldn't load correction requests.",
        ),
      }
    }
    const rows = (data ?? []) as unknown as CorrectionRow[]
    const notes = await adminNotes(
      supabase,
      rows.map((row) => row.id),
      'getOfferCorrectionsAction',
    )
    if (!notes) {
      return { success: false, error: "We couldn't load correction requests." }
    }

    return {
      success: true,
      corrections: rows.map((row) => {
        const s = row.snapshot ?? {}
        return {
          id: row.id,
          offerId: row.offer_id,
          offerTitle: row.promo_offer_master
            ? resolveOfferTitle(row.promo_offer_master)
            : null,
          businessId: row.business_id,
          businessName: row.master_business_info?.name ?? null,
          note: row.note ?? '',
          status: row.status,
          adminNote: notes.get(row.id) ?? null,
          createdAt: row.created_at,
          resolvedAt: row.resolved_at,
          snapshot: {
            discountPrice: numberOrNull(s.discount_price),
            regularPrice: numberOrNull(s.regular_price),
            discountPercent: numberOrNull(s.discount_percent),
            discountAmount: numberOrNull(s.discount_amount),
            priceModel:
              typeof s.price_model === 'string' ? s.price_model : null,
          },
        }
      }),
    }
  } catch (error) {
    return failure('getOfferCorrectionsAction', error)
  }
}

/**
 * Set a row's status and admin note. The database stamps resolved_at / resolved_by, refuses any
 * other column (42501), and an UPDATE that matched nothing is reported, not assumed.
 */
async function resolve(
  table: 'deal_reports' | 'offer_confirmations',
  id: unknown,
  status: unknown,
  adminNote: unknown,
  action: string,
  auditTarget: string,
): Promise<AdminFeedbackResult> {
  const { supabase } = await requireAdmin()
  if (!isUuid(id))
    return { success: false, error: "We couldn't find that item." }
  if (!isOneOf(FEEDBACK_STATUSES, status)) {
    return { success: false, error: 'Pick a status from the list.' }
  }
  const note = cleanNote(adminNote, NOTE_MAX.admin) || null

  const { data, error } = await supabase
    .from(table)
    .update({ status, admin_note: note })
    .eq('id', id)
    .select('id, status, offer_id')
  if (error) {
    logSupabaseError(action, error, { id })
    return {
      success: false,
      error: publicErrorMessage(error, "We couldn't update that item."),
    }
  }
  if (!data || data.length === 0) {
    return {
      success: false,
      error: 'That item was not updated. It may have been removed.',
    }
  }

  await logAdminAction(
    `${auditTarget}_${status === 'open' ? 'reopened' : status}`,
    auditTarget,
    id,
    { admin_note: note },
  )
  revalidatePath('/admin/dashboard', 'layout')
  // A dismissed or reopened confirmation moves the deal page's badge.
  const offerId = (data[0] as { offer_id: number | null }).offer_id
  if (table === 'offer_confirmations' && offerId) {
    revalidatePath(`/deals/${offerId}`)
  }
  return { success: true }
}

/** Resolve, dismiss or reopen a deal report or claim answer, with an optional admin note. */
export async function resolveDealReportAction(
  reportId: string,
  status: FeedbackStatus,
  adminNote?: string,
): Promise<AdminFeedbackResult> {
  try {
    return await resolve(
      'deal_reports',
      reportId,
      status,
      adminNote,
      'resolveDealReportAction',
      'deal_report',
    )
  } catch (error) {
    return failure('resolveDealReportAction', error)
  }
}

/**
 * Resolve, dismiss or reopen an owner's correction request. Works on a confirmation too:
 * dismissing one withdraws its public badge (public_offer_confirmations skips dismissed rows).
 */
export async function resolveOfferCorrectionAction(
  correctionId: string,
  status: FeedbackStatus,
  adminNote?: string,
): Promise<AdminFeedbackResult> {
  try {
    return await resolve(
      'offer_confirmations',
      correctionId,
      status,
      adminNote,
      'resolveOfferCorrectionAction',
      'offer_confirmation',
    )
  } catch (error) {
    return failure('resolveOfferCorrectionAction', error)
  }
}
