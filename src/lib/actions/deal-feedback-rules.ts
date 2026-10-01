/**
 * The vocabularies deal_reports and offer_confirmations accept, and the input checks their
 * actions share. A plain module, not `'use server'` (those may export only async functions), so
 * the report form, the claim question, the admin queue and tests/unit/dealFeedbackRules.test.ts
 * all read one list. The CHECK constraints in supabase/migrations/20260928010001 and 0002 are the
 * authority; these mirror them, and a value missing here is refused before it costs a round trip.
 */

export const DEAL_REPORT_REASONS = [
  'wrong_price',
  'ended',
  'not_honored',
  'terms_differ',
  'other',
] as const
export type DealReportReason = (typeof DEAL_REPORT_REASONS)[number]

/** Spec §3 wording, in the order the form lists them. */
export const DEAL_REPORT_REASON_LABELS: Record<DealReportReason, string> = {
  wrong_price: 'The price is wrong',
  ended: 'The deal has ended',
  not_honored: "The clinic wouldn't honor it",
  terms_differ: 'The terms are different',
  other: 'Something else',
}

export const CLAIM_FEEDBACK_ANSWERS = [
  'honored',
  'different_price',
  'not_honored',
] as const
export type ClaimFeedbackAnswer = (typeof CLAIM_FEEDBACK_ANSWERS)[number]

/** Answers to "Did the clinic honor this price?" (spec §5). */
export const CLAIM_FEEDBACK_LABELS: Record<ClaimFeedbackAnswer, string> = {
  honored: 'Yes',
  different_price: 'A different price',
  not_honored: 'No',
}

export const FEEDBACK_STATUSES = ['open', 'resolved', 'dismissed'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]

/** The database's length CHECKs. */
export const NOTE_MAX = { report: 1000, correction: 2000, admin: 2000 } as const

/**
 * Free text as it may be stored: markup stripped (an admin screen and the ops inbox read it
 * back), trimmed, capped at the column's CHECK so an over-long paste is shortened rather than
 * refused with a 23514. Same rule as clean() in src/app/business/listing-request/actions.ts.
 */
export function cleanNote(value: unknown, max: number): string {
  return (typeof value === 'string' ? value : '')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, max)
}

export function isOneOf<T extends readonly string[]>(
  list: T,
  value: unknown,
): value is T[number] {
  return typeof value === 'string' && list.includes(value)
}

/** A promo_offer_master id as a client may send it: a positive safe integer. */
export function isOfferId(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A claims / deal_reports / offer_confirmations id. Checked before it reaches a uuid column. */
export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
