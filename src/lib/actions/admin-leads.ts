'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { closedReason, isExpiringSoon } from '@/lib/actions/admin-lead-queue'
import { fetchUserEmails } from '@/lib/actions/admin-user-emails'
import { logAdminAction } from '@/lib/actions/audit'
import { requireAdmin } from '@/lib/auth/guards'
import { OFFER_TITLE_SELECT, resolveOfferTitle } from '@/lib/data/offers'
import { leadRelayedEmail } from '@/lib/email/adminTemplates'
import { notifyOwnerOfNewClaim } from '@/lib/email/ownerNotifications'
import { sendEmail } from '@/lib/email/send'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError, type SupabaseLikeError } from '@/lib/logger'

interface LeadActionResult {
  success: boolean
  error?: string
  /** The write landed but something around it did not (an email, an unapplied migration). */
  warning?: string
}

/**
 * How the admin got the lead to the business.
 *
 * One value per handle the screen can actually offer, not a wish list:
 * `master_business_info` stores a website, two social URLs and — since 2026-09-16 — a `phone`
 * (365 of 419 businesses). It still stores NO email for a business; the only email we hold is the
 * account address of an owner who has claimed the listing (`business_profiles.email`, 1 of 419).
 * `manual` remains the honest catch-all.
 *
 * Exported as a type so the screen cannot drift from the server's vocabulary. The runtime
 * whitelist below is deliberately NOT exported — a `'use server'` module may only export async
 * functions, and more to the point this list is a trust boundary, not shared UI config.
 */
export type RelayMethod =
  | 'email'
  | 'website'
  | 'facebook'
  | 'instagram'
  | 'phone'
  | 'manual'

const RELAY_METHODS: readonly RelayMethod[] = [
  'email',
  'website',
  'facebook',
  'instagram',
  'phone',
  'manual',
]

/** What happened when the admin reached out. Mirrors claims_relay_outcome_check. */
export type RelayOutcome =
  | 'reached_clinic'
  | 'left_voicemail'
  | 'no_answer'
  | 'clinic_declined'
  | 'other'

const RELAY_OUTCOMES: readonly RelayOutcome[] = [
  'reached_clinic',
  'left_voicemail',
  'no_answer',
  'clinic_declined',
  'other',
]

/**
 * Outcomes after which "We passed your request to <clinic>" is true. After "No answer" or
 * "Clinic declined" it is not, so the customer email is refused rather than sent.
 */
const NOTIFIABLE_OUTCOMES: readonly RelayOutcome[] = [
  'reached_clinic',
  'left_voicemail',
  'other',
]

const NOTE_MAX_CHARS = 1000
const EXTEND_DAYS = 7
const DAY_MS = 24 * 60 * 60 * 1000

/** The closed list is history, not a queue. The pending queue is never capped. */
const CLOSED_HISTORY_LIMIT = 50

export interface LeadRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: string
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  relayed_at: string | null
  relayed_by: string | null
  relay_method: string | null
  /** Migration 20260924020001. null until it is applied. */
  relay_outcome: string | null
  relay_note: string | null
  admin_closed_at: string | null
  admin_close_reason: string | null
  /**
   * Why an unrelayed lead is out of the pending queue, in words; null while it is waiting.
   * Derived here, once, so the queue and the home-page count use the same rule.
   */
  closed_reason: string | null
  created_at: string
  /**
   * `claims.expires_at`, NOT NULL DEFAULT now() + 7 days: the relay deadline. Past it the claim
   * leaves the pending queue. The customer keeps the clinic's details regardless (claims keep
   * their revealed snapshot, 20260924010001). "Extend 7 days" pushes the deadline out.
   */
  expires_at: string
  deal_title: string | null
  business_name: string | null
  business_city: string | null
  business_address: string | null
  /** The business's own phone, E.164 (20260916020001_add_business_phone.sql). */
  business_phone: string | null
  business_website: string | null
  business_facebook_url: string | null
  business_instagram_url: string | null
  business_google_place_id: string | null
  /** Account email of the owner who has an APPROVED claim on this listing; null when unclaimed. */
  owner_email: string | null
  /** Name on that owner's account, so the operator knows who they are writing to. */
  owner_name: string | null
  consumer_name: string | null
  consumer_email: string | null
  consumer_phone: string | null
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

interface RawLeadRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: string
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  relayed_at: string | null
  relayed_by: string | null
  relay_method: string | null
  relay_outcome?: string | null
  relay_note?: string | null
  admin_closed_at?: string | null
  admin_close_reason?: string | null
  created_at: string
  expires_at: string
  master_business_info: {
    name: string | null
    city: string | null
    address: string | null
    phone: string | null
    website: string | null
    facebook_url: string | null
    instagram_url: string | null
    google_place_id: string | null
  } | null
  promo_offer_master: {
    offer_raw_text: string | null
    promo_offer_items:
      | { offer_item_id: number; item_name: string | null }[]
      | null
  } | null
  profiles: {
    first_name: string | null
    last_name: string | null
    phone: string | null
  } | null
}

/**
 * Claim columns plus everything that identifies the two parties.
 *
 * The embeds are named with their constraint (`!fk_claims_business`) rather than by table so
 * PostgREST cannot pick a different relationship if another FK is ever added. All three are
 * readable by an admin: master_business_info SELECT is `true`, and promo_offer_master,
 * promo_offer_items and profiles each carry an is_admin() read policy.
 */
const LEAD_SELECT = `
  id, consumer_id, deal_id, business_id, status,
  preferred_date, preferred_time, notes,
  relayed_at, relayed_by, relay_method, created_at, expires_at,
  master_business_info!fk_claims_business(
    name, city, address, phone, website, facebook_url, instagram_url, google_place_id
  ),
  promo_offer_master!fk_claims_deal(${OFFER_TITLE_SELECT}),
  profiles!claims_consumer_id_fkey(first_name, last_name, phone)
`

/** Added by migration 20260924020001_admin_lead_workflow.sql. */
const WORKFLOW_COLUMNS =
  'relay_outcome, relay_note, admin_closed_at, admin_close_reason'

const MIGRATION_PENDING =
  'This needs a database update (migration 20260924020001) that has not been applied yet. Nothing was changed.'

/**
 * claims_active_unique is one live claim per (consumer, deal). Putting an expired claim back to
 * `pending` collides with it when the customer has since claimed the same deal again.
 */
const DUPLICATE_ACTIVE_CLAIM =
  'The customer has claimed this deal again since, so this older claim cannot go back in the queue. Work the newer claim instead. Nothing was changed.'

/** 42703 from a SELECT naming a missing column; PGRST204 from an UPDATE body naming one. */
function isMissingColumn(error: SupabaseLikeError | null): boolean {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

/**
 * Run a claims read with the workflow columns, and once more without them if they do not exist.
 *
 * ponytail: one extra round trip per read until 20260924020001 is applied, then never. It keeps
 * the queue on screen in the gap between this code deploying and the migration landing; delete
 * the fallback once the migration is in the ledger.
 */
async function withWorkflowColumns<T>(
  base: string,
  build: (
    columns: string,
  ) => PromiseLike<{ data: unknown; error: SupabaseLikeError | null }>,
): Promise<{ data: T[] | null; error: SupabaseLikeError | null }> {
  let result = await build(`${base}, ${WORKFLOW_COLUMNS}`)
  if (isMissingColumn(result.error)) result = await build(base)
  // The client is untyped (no Database parameter) and the column list is a runtime string, so
  // PostgREST's row type cannot be inferred; T is the caller's statement of the select.
  return { data: result.data as T[] | null, error: result.error }
}

/**
 * Attach the contact details that are not on `claims` itself.
 *
 * Two extra round trips for the whole page, not one per row: the owner's account email by
 * business_id (`business_profiles` has no FK from `claims`), and the consumer's email through
 * admin_user_emails() (see admin-user-emails.ts).
 *
 * A failure here is propagated, never swallowed. Falling back to nulls would render "No email
 * on file" for a consumer who has one — a confident lie on the one screen whose whole job is
 * getting hold of people.
 */
async function resolveLeadDetails(
  supabase: AdminClient,
  rows: RawLeadRow[],
  now: number,
): Promise<{ leads?: LeadRow[]; error?: string }> {
  if (rows.length === 0) return { leads: [] }

  const businessIds = [...new Set(rows.map((row) => row.business_id))]

  const [ownerResult, emailResult] = await Promise.all([
    supabase
      .from('business_profiles')
      .select('business_id, email, first_name, last_name, claim_status')
      .in('business_id', businessIds),
    fetchUserEmails(
      supabase,
      rows.map((row) => row.consumer_id),
    ),
  ])

  if (ownerResult.error) {
    logSupabaseError('resolveLeadDetails.owners', ownerResult.error)
    return {
      error: publicErrorMessage(
        ownerResult.error,
        "We couldn't load the clinics' owner accounts.",
      ),
    }
  }
  // fetchUserEmails already logged the failing batch.
  if (emailResult.error)
    return {
      error: publicErrorMessage(
        emailResult.error,
        "We couldn't load customers' email addresses.",
      ),
    }
  const consumerEmailById = emailResult.emails ?? new Map<string, string>()

  const ownerByBusiness = new Map<
    number,
    { email: string; name: string | null }
  >()
  for (const owner of (ownerResult.data ?? []) as {
    business_id: number | null
    email: string | null
    first_name: string | null
    last_name: string | null
    claim_status: string | null
  }[]) {
    // Only an approved claim means this account speaks for the business.
    if (owner.claim_status === 'approved' && owner.business_id && owner.email) {
      const name = [owner.first_name, owner.last_name]
        .filter(Boolean)
        .join(' ')
        .trim()
      ownerByBusiness.set(owner.business_id, {
        email: owner.email,
        name: name || null,
      })
    }
  }

  const leads = rows.map((row): LeadRow => {
    const business = row.master_business_info
    const consumer = row.profiles
    const name = [consumer?.first_name, consumer?.last_name]
      .filter(Boolean)
      .join(' ')
      .trim()

    return {
      id: row.id,
      consumer_id: row.consumer_id,
      deal_id: row.deal_id,
      business_id: row.business_id,
      status: row.status,
      preferred_date: row.preferred_date,
      preferred_time: row.preferred_time,
      notes: row.notes,
      relayed_at: row.relayed_at,
      relayed_by: row.relayed_by,
      relay_method: row.relay_method,
      relay_outcome: row.relay_outcome ?? null,
      relay_note: row.relay_note ?? null,
      admin_closed_at: row.admin_closed_at ?? null,
      admin_close_reason: row.admin_close_reason ?? null,
      closed_reason: row.relayed_at ? null : closedReason(row, now),
      created_at: row.created_at,
      expires_at: row.expires_at,
      deal_title: row.promo_offer_master
        ? resolveOfferTitle(row.promo_offer_master)
        : null,
      business_name: business?.name ?? null,
      business_city: business?.city ?? null,
      business_address: business?.address ?? null,
      business_phone: business?.phone ?? null,
      business_website: business?.website ?? null,
      business_facebook_url: business?.facebook_url ?? null,
      business_instagram_url: business?.instagram_url ?? null,
      business_google_place_id: business?.google_place_id ?? null,
      owner_email: ownerByBusiness.get(row.business_id)?.email ?? null,
      owner_name: ownerByBusiness.get(row.business_id)?.name ?? null,
      consumer_name: name || null,
      consumer_email: consumerEmailById.get(row.consumer_id) ?? null,
      consumer_phone: consumer?.phone ?? null,
    }
  })

  return { leads }
}

function failure(action: string, error: unknown): LeadActionResult {
  logger.error(`${action} failed`, {
    action,
    error: error instanceof Error ? error.message : String(error),
  })
  // requireAdmin() throws on an unauthorized caller, so surface its message rather than
  // masking a permission denial as an unexpected failure.
  return {
    success: false,
    error:
      error instanceof Error ? error.message : 'An unexpected error occurred.',
  }
}

/**
 * Every unrelayed claim, split into the queue the admin works and the ones already out of it.
 *
 * `pending` is ordered by expires_at, so the lead closest to its deadline is the first card.
 * `closed` is newest-deadline first and capped at CLOSED_HISTORY_LIMIT.
 *
 * ponytail: reads every unrelayed claim and partitions here, because the partition rule needs
 * columns that may not exist yet (see withWorkflowColumns). Unrelayed claims only grow by
 * cancellations and expiries; move the split into the query with `.or()` once that is thousands.
 */
export async function getUnrelayedLeadsAction(): Promise<{
  success: boolean
  error?: string
  pending?: LeadRow[]
  closed?: LeadRow[]
}> {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await withWorkflowColumns<RawLeadRow>(
      LEAD_SELECT,
      (columns) =>
        supabase
          .from('claims')
          .select(columns)
          .is('relayed_at', null)
          .order('expires_at', { ascending: true })
          .order('created_at', { ascending: true }),
    )

    if (error) {
      logSupabaseError('getUnrelayedLeadsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load the lead queue."),
      }
    }

    const now = Date.now()
    const rows = data ?? []
    const waiting = rows.filter((row) => closedReason(row, now) === null)
    const closed = rows
      .filter((row) => closedReason(row, now) !== null)
      .reverse()
      .slice(0, CLOSED_HISTORY_LIMIT)

    const resolved = await resolveLeadDetails(
      supabase,
      [...waiting, ...closed],
      now,
    )
    if (resolved.error) return { success: false, error: resolved.error }

    const leads = resolved.leads ?? []
    return {
      success: true,
      pending: leads.filter((lead) => lead.closed_reason === null),
      closed: leads.filter((lead) => lead.closed_reason !== null),
    }
  } catch (error) {
    return failure('getUnrelayedLeadsAction', error)
  }
}

/**
 * Fetch the most recent relayed leads (history).
 */
export async function getRelayedLeadsAction(): Promise<{
  success: boolean
  error?: string
  leads?: LeadRow[]
}> {
  try {
    const { supabase } = await requireAdmin()

    const { data, error } = await withWorkflowColumns<RawLeadRow>(
      LEAD_SELECT,
      (columns) =>
        supabase
          .from('claims')
          .select(columns)
          .not('relayed_at', 'is', null)
          .order('relayed_at', { ascending: false })
          .limit(50),
    )

    if (error) {
      logSupabaseError('getRelayedLeadsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't load relayed leads."),
      }
    }

    const resolved = await resolveLeadDetails(supabase, data ?? [], Date.now())
    if (resolved.error) return { success: false, error: resolved.error }

    return { success: true, leads: resolved.leads }
  } catch (error) {
    return failure('getRelayedLeadsAction', error)
  }
}

/**
 * The two numbers the admin home page leads with. Same rule as the pending queue
 * (closedReason), so the tile and the screen it links to can never disagree.
 */
export async function getLeadCountsAction(): Promise<{
  success: boolean
  error?: string
  waiting?: number
  expiringSoon?: number
}> {
  try {
    const { supabase } = await requireAdmin()
    const now = Date.now()

    const { data, error } = await withWorkflowColumns<
      Pick<
        RawLeadRow,
        'status' | 'expires_at' | 'admin_closed_at' | 'admin_close_reason'
      >
    >('status, expires_at', (columns) =>
      supabase
        .from('claims')
        .select(columns)
        .is('relayed_at', null)
        .eq('status', 'pending')
        .gt('expires_at', new Date(now).toISOString()),
    )

    if (error) {
      logSupabaseError('getLeadCountsAction', error)
      return {
        success: false,
        error: publicErrorMessage(error, "We couldn't count leads."),
      }
    }

    const waiting = (data ?? []).filter(
      (row) => closedReason(row, now) === null,
    )
    return {
      success: true,
      waiting: waiting.length,
      expiringSoon: waiting.filter((row) => isExpiringSoon(row, now)).length,
    }
  } catch (error) {
    return failure('getLeadCountsAction', error)
  }
}

/**
 * Write to one claim and PROVE it landed. An RLS-filtered or guard-filtered UPDATE is zero rows
 * and `error: null`, which would otherwise read as success.
 *
 * `optional` holds workflow columns that may not exist yet: on a missing-column error the write
 * is retried without them and `droppedOptional` says so. Without `optional`, a missing column
 * means the whole action needs the migration, and the admin is told that.
 */
async function updateClaim(
  supabase: AdminClient,
  claimId: string,
  patch: Record<string, unknown>,
  options: {
    action: string
    notFound: string
    optional?: Record<string, unknown>
    only?: 'relayed' | 'unrelayed'
  },
): Promise<{ droppedOptional: boolean } | { error: string }> {
  const run = (body: Record<string, unknown>) => {
    let query = supabase.from('claims').update(body).eq('id', claimId)
    if (options.only === 'unrelayed') query = query.is('relayed_at', null)
    if (options.only === 'relayed') query = query.not('relayed_at', 'is', null)
    return query.select('id')
  }

  let droppedOptional = false
  let { data, error } = await run({ ...patch, ...options.optional })
  if (options.optional && isMissingColumn(error)) {
    droppedOptional = true
    ;({ data, error } = await run(patch))
  }

  if (error) {
    logSupabaseError(options.action, error, { claimId })
    if (isMissingColumn(error)) return { error: MIGRATION_PENDING }
    if (error.code === '23505') return { error: DUPLICATE_ACTIVE_CLAIM }
    return { error: publicErrorMessage(error, "We couldn't update this lead.") }
  }
  if (!data || data.length === 0) return { error: options.notFound }
  return { droppedOptional }
}

/** Trimmed, length-checked free text. undefined/empty → null. */
function cleanText(
  value: unknown,
  label: string,
): { text: string | null } | { error: string } {
  if (value == null) return { text: null }
  if (typeof value !== 'string') return { error: `${label} must be text.` }
  const text = value.trim()
  if (text.length > NOTE_MAX_CHARS) {
    return {
      error: `${label} is ${text.length} characters. Keep it under ${NOTE_MAX_CHARS}.`,
    }
  }
  return { text: text || null }
}

/**
 * Email the customer that their request was passed on. Returns a sentence for the admin when
 * it did NOT go out; undefined when it did. Never fails the relay, which has already landed.
 */
async function emailCustomerAboutRelay(
  supabase: AdminClient,
  claimId: string,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('claims')
    .select(LEAD_SELECT)
    .eq('id', claimId)
  if (error) {
    logSupabaseError('emailCustomerAboutRelay', error, { claimId })
    return 'No email was sent to the customer: the claim could not be read back.'
  }

  const resolved = await resolveLeadDetails(
    supabase,
    (data ?? []) as unknown as RawLeadRow[],
    Date.now(),
  )
  const lead = resolved.leads?.[0]
  if (!lead) {
    return `No email was sent to the customer: ${resolved.error ?? 'the claim could not be read back.'}`
  }
  if (!lead.consumer_email) {
    return 'No email was sent: the customer has no email address on file.'
  }

  const { subject, html } = leadRelayedEmail({
    consumerName: lead.consumer_name,
    clinicName: lead.business_name ?? 'the clinic',
    dealTitle: lead.deal_title,
    preferredDate: lead.preferred_date,
    preferredTime: lead.preferred_time,
    notes: lead.notes,
    clinicPhone: lead.business_phone,
    clinicWebsite: lead.business_website,
  })

  // Awaited, not after(): the admin asked for this email and is told whether it went.
  const sent = await sendEmail(
    lead.consumer_email,
    subject,
    html,
    'markLeadRelayedAction',
    // The recipient is the customer, not the signed-in admin, so the opt-out check needs
    // their id to find the right account.
    { recipientUserId: lead.consumer_id },
  )
  if (sent.suppressed) {
    return 'No email was sent: the customer has turned off email notifications.'
  }
  if (!sent.success) {
    return `The email to the customer failed: ${sent.error ?? 'unknown error'}.`
  }
  return undefined
}

/**
 * Mark a lead as relayed, recording the channel, what happened, and an optional note.
 *
 * Every input is re-validated here: this module is `'use server'`, so every export is a public
 * HTTP endpoint and the TypeScript unions are erased before the request arrives.
 *
 * Only an unrelayed claim can be relayed (`only: 'unrelayed'`), so a double click or a stale
 * tab cannot overwrite the first record. "Undo relay" is the way to change one.
 */
export async function markLeadRelayedAction(
  claimId: string,
  input: {
    method: RelayMethod
    outcome: RelayOutcome
    note?: string | null
    notifyCustomer?: boolean
  },
): Promise<LeadActionResult> {
  try {
    const { supabase, user } = await requireAdmin()

    if (!RELAY_METHODS.includes(input?.method)) {
      return {
        success: false,
        error: `"${String(input?.method)}" isn't a relay method we record.`,
      }
    }
    if (!RELAY_OUTCOMES.includes(input.outcome)) {
      return {
        success: false,
        error: `"${String(input.outcome)}" isn't an outcome we record.`,
      }
    }
    const note = cleanText(input.note, 'The note')
    if ('error' in note) return { success: false, error: note.error }

    const notify = input.notifyCustomer === true
    if (notify && !NOTIFIABLE_OUTCOMES.includes(input.outcome)) {
      return {
        success: false,
        error:
          "The customer email says we passed their request on, which isn't true for that outcome. Untick it, or pick another outcome.",
      }
    }

    const written = await updateClaim(
      supabase,
      claimId,
      {
        relayed_at: new Date().toISOString(),
        relayed_by: user.id,
        relay_method: input.method,
      },
      {
        action: 'markLeadRelayedAction',
        notFound:
          'That lead was not updated. It may already be marked relayed. Refresh the queue.',
        optional: { relay_outcome: input.outcome, relay_note: note.text },
        only: 'unrelayed',
      },
    )
    if ('error' in written) return { success: false, error: written.error }

    const warnings: string[] = []
    if (written.droppedOptional) {
      warnings.push(
        'The outcome and note were not saved: the database has not been updated for them yet (migration 20260924020001).',
      )
    }
    const emailProblem = notify
      ? await emailCustomerAboutRelay(supabase, claimId)
      : undefined
    if (emailProblem) warnings.push(emailProblem)

    // The clinic's approved owner, if it has one (1 of 419 today), gets its "New lead" email.
    // It needs an admin session to find the owner's address, which is why it is sent from here
    // and not at claim time. It never throws; after() keeps it off the relay's response time.
    after(() => notifyOwnerOfNewClaim(claimId))

    await logAdminAction('lead_relayed', 'lead', claimId, {
      method: input.method,
      outcome: written.droppedOptional ? null : input.outcome,
      customer_emailed: notify && !emailProblem,
    })

    revalidatePath('/admin/dashboard/leads')
    return {
      success: true,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    }
  } catch (error) {
    return failure('markLeadRelayedAction', error)
  }
}

/** Put a relayed lead back in the queue, clearing everything the relay recorded. */
export async function undoLeadRelayAction(
  claimId: string,
): Promise<LeadActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const written = await updateClaim(
      supabase,
      claimId,
      { relayed_at: null, relayed_by: null, relay_method: null },
      {
        action: 'undoLeadRelayAction',
        notFound: 'That lead was not updated. It may not be relayed any more.',
        optional: { relay_outcome: null, relay_note: null },
        only: 'relayed',
      },
    )
    if ('error' in written) return { success: false, error: written.error }

    await logAdminAction('lead_relay_undone', 'lead', claimId)
    revalidatePath('/admin/dashboard/leads')
    return { success: true }
  } catch (error) {
    return failure('undoLeadRelayAction', error)
  }
}

/** Take an unrelayed lead out of the queue without relaying it. A reason is required. */
export async function closeLeadAction(
  claimId: string,
  reason: string,
): Promise<LeadActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const cleaned = cleanText(reason, 'The reason')
    if ('error' in cleaned) return { success: false, error: cleaned.error }
    if (!cleaned.text) {
      return {
        success: false,
        error: 'Add a reason, so the next person knows why it was closed.',
      }
    }

    const written = await updateClaim(
      supabase,
      claimId,
      {
        admin_closed_at: new Date().toISOString(),
        admin_close_reason: cleaned.text,
      },
      {
        action: 'closeLeadAction',
        notFound:
          'That lead was not closed. It may have been relayed meanwhile. Refresh the queue.',
        only: 'unrelayed',
      },
    )
    if ('error' in written) return { success: false, error: written.error }

    await logAdminAction('lead_closed', 'lead', claimId, {
      reason: cleaned.text,
    })
    revalidatePath('/admin/dashboard/leads')
    return { success: true }
  } catch (error) {
    return failure('closeLeadAction', error)
  }
}

/** Undo "Close without relaying". */
export async function reopenLeadAction(
  claimId: string,
): Promise<LeadActionResult> {
  try {
    const { supabase } = await requireAdmin()

    const written = await updateClaim(
      supabase,
      claimId,
      { admin_closed_at: null, admin_close_reason: null },
      {
        action: 'reopenLeadAction',
        notFound: 'That lead was not reopened. Refresh the queue.',
        only: 'unrelayed',
      },
    )
    if ('error' in written) return { success: false, error: written.error }

    await logAdminAction('lead_reopened', 'lead', claimId)
    revalidatePath('/admin/dashboard/leads')
    return { success: true }
  } catch (error) {
    return failure('reopenLeadAction', error)
  }
}

/**
 * Give a lead seven more days before it expires from the queue. This moves the relay deadline
 * only: the customer keeps the clinic's details whatever expires_at says.
 *
 * Seven days from the later of the current deadline and now: on an already-expired claim,
 * "deadline + 7 days" could still be in the past. A claim marked `expired` (done on the
 * customer's next claim, by enforce_active_claim_limit) goes back to `pending`, which raises
 * 23505 if the customer has since claimed the same deal again; updateClaim says so plainly.
 */
export async function extendLeadAction(
  claimId: string,
): Promise<LeadActionResult & { expiresAt?: string }> {
  try {
    const { supabase } = await requireAdmin()

    const { data: current, error: readError } = await supabase
      .from('claims')
      .select('expires_at, status')
      .eq('id', claimId)
      .maybeSingle()
    if (readError) {
      logSupabaseError('extendLeadAction.read', readError, { claimId })
      return {
        success: false,
        error: publicErrorMessage(readError, "We couldn't read this lead."),
      }
    }
    if (!current) {
      return { success: false, error: 'That lead could not be found.' }
    }

    const from = Math.max(Date.parse(current.expires_at), Date.now())
    const expiresAt = new Date(from + EXTEND_DAYS * DAY_MS).toISOString()
    const patch: Record<string, unknown> = { expires_at: expiresAt }
    if (current.status === 'expired') patch.status = 'pending'

    const written = await updateClaim(supabase, claimId, patch, {
      action: 'extendLeadAction',
      notFound: 'That lead was not extended. Refresh the queue.',
    })
    if ('error' in written) return { success: false, error: written.error }

    await logAdminAction('lead_extended', 'lead', claimId, {
      from: current.expires_at,
      to: expiresAt,
    })
    revalidatePath('/admin/dashboard/leads')
    return { success: true, expiresAt }
  } catch (error) {
    return failure('extendLeadAction', error)
  }
}
