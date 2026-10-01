/**
 * The admin relay queue's two rules. A plain module, not `'use server'`: those may export only
 * async functions, and these are pure so tests/unit/leadQueue.test.ts can pin them. The queue,
 * the closed list and the admin home tile all read them through admin-leads.ts.
 */

/** The claim columns the rules read. The admin_* pair is absent until 20260924020001 lands. */
export interface QueueRow {
  status: string
  expires_at: string
  admin_closed_at?: string | null
  admin_close_reason?: string | null
}

const URGENT_MS = 48 * 60 * 60 * 1000

const STATUS_CLOSED_REASON: Record<string, string> = {
  cancelled: 'Cancelled by the customer',
  contacted: 'The clinic marked it contacted',
  booked: 'The clinic marked it booked',
  completed: 'The clinic marked it completed',
  expired: 'Expired',
}

/**
 * The one rule for "is this unrelayed lead still waiting". null = waiting.
 *
 * `expired` is either the status impl-claims' expiry job sets or expires_at already past; the
 * row can carry `pending` for a while after its deadline, so the timestamp is checked too.
 * Relayed rows never reach this: the queue reads `relayed_at IS NULL` only.
 */
export function closedReason(row: QueueRow, now: number): string | null {
  if (row.admin_closed_at) {
    return `Closed by an admin: ${row.admin_close_reason || 'no reason given'}`
  }
  if (row.status !== 'pending') {
    return STATUS_CLOSED_REASON[row.status] ?? `Status: ${row.status}`
  }
  if (Date.parse(row.expires_at) <= now) return 'Expired'
  return null
}

/** A waiting lead inside 48 hours of its relay deadline (the home tile's "expire within 48 hours"). */
export function isExpiringSoon(
  row: Pick<QueueRow, 'expires_at'>,
  now: number,
): boolean {
  return Date.parse(row.expires_at) - now < URGENT_MS
}
