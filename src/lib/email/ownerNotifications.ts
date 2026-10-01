/**
 * Email the business owner about a lead or a customer message.
 *
 * Before this the owner of business 765 found out about a lead only by logging in: the claim
 * notice went to the ops inbox and nothing went to the owner, while Settings promised "New lead
 * alerts".
 *
 * Deliberately NOT a Server Action (see send.ts): every export of a 'use server' module is a
 * public HTTP endpoint, and these send mail. Callers reach them through `after()`; they never
 * throw and never fail the action that triggered them.
 *
 * WHO CAN SEND. The owner's address comes from `claim_owner_notice_email` (migration
 * 20260924030003), which answers ONLY an admin or the service_role and returns NULL to everyone
 * else — a consumer must never learn an owner's login address. So these send from an admin's
 * session (impl-admin's "Mark relayed" calls notifyOwnerOfNewClaim) and are silent no-ops in a
 * consumer's request (the claim action and sendMessageAction). Sending at the moment a consumer
 * claims or messages needs a server-side sending identity — a service-role key on the server, or
 * a database-side sender — which is an owner step. When one exists, only ownerEmail() below needs
 * to change for both sends to work from the consumer's request.
 *
 * NULL also means the business has no approved owner — 418 of 419 today — so it is not logged.
 */

import { OFFER_TITLE_SELECT, resolveOfferTitle } from '@/lib/data/offers'
import { newLeadEmail, newMessageEmail } from '@/lib/email/ownerTemplates'
import { sendEmail } from '@/lib/email/send'
import { logger, logSupabaseError } from '@/lib/logger'
import { createSupabaseServerClient } from '@/lib/supabase-server'

type Supabase = Awaited<ReturnType<typeof createSupabaseServerClient>>

interface ClaimForNotice {
  deal_id: number
  business_id: number
  preferred_date: string | null
  preferred_time: string | null
  /** Snapshot written at claim time, when that column exists; read defensively. */
  deal_title?: string | null
}

async function ownerEmail(
  supabase: Supabase,
  claimId: string,
): Promise<string | null> {
  const { data, error } = await supabase.rpc('claim_owner_notice_email', {
    p_claim_id: claimId,
  })
  if (error) {
    logSupabaseError('claim_owner_notice_email', error, { claimId })
    return null
  }
  return typeof data === 'string' && data ? data : null
}

/**
 * The owner's auth user id, so sendEmail can check their opt-out and tokenise their unsubscribe
 * link. Same rule as claim_owner_notice_email (first approved business_profiles row); read under
 * the admin's session, which is the only one ownerEmail() answers for anyway.
 */
async function ownerUserId(
  supabase: Supabase,
  businessId: number,
): Promise<string | undefined> {
  const { data, error } = await supabase
    .from('business_profiles')
    .select('id')
    .eq('business_id', businessId)
    .eq('claim_status', 'approved')
    .order('created_at')
    .limit(1)
    .maybeSingle()
  if (error) {
    logSupabaseError('ownerNotifications.ownerUserId', error, { businessId })
    return undefined
  }
  return data?.id ?? undefined
}

async function loadClaim(
  supabase: Supabase,
  claimId: string,
): Promise<ClaimForNotice | null> {
  // '*' rather than a column list: deal_title is a snapshot column another change adds, and
  // naming it before that migration lands would fail the whole read with 42703.
  const { data, error } = await supabase
    .from('claims')
    .select('*')
    .eq('id', claimId)
    .maybeSingle()
  if (error) {
    logSupabaseError('ownerNotifications.loadClaim', error, { claimId })
    return null
  }
  return data as ClaimForNotice | null
}

async function dealTitle(
  supabase: Supabase,
  claim: ClaimForNotice,
): Promise<string | null> {
  if (claim.deal_title) return claim.deal_title
  const { data, error } = await supabase
    .from('promo_offer_master')
    .select(OFFER_TITLE_SELECT)
    .eq('id', claim.deal_id)
    .maybeSingle()
  if (error) {
    logSupabaseError('ownerNotifications.dealTitle', error, {
      dealId: claim.deal_id,
    })
    return null
  }
  return data ? resolveOfferTitle(data) : null
}

/**
 * "New lead: <deal>" with the preferred date and time and a link to the lead. No contact details.
 *
 * Sends only from an admin (or service_role) session. From a consumer's request the lookup
 * returns NULL and this returns without sending or logging: consumer-triggered sends need a
 * server-side sending identity (a service-role key or a database-side sender), an owner step.
 */
export async function notifyOwnerOfNewClaim(claimId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    const to = await ownerEmail(supabase, claimId)
    if (!to) return // not an admin session, or no owner: a silent no-op by design

    const claim = await loadClaim(supabase, claimId)
    if (!claim) return

    const { subject, html } = newLeadEmail({
      claimId,
      dealTitle: (await dealTitle(supabase, claim)) ?? 'one of your deals',
      preferredDate: claim.preferred_date,
      preferredTime: claim.preferred_time,
    })
    // sendEmail logs its own failures under this action name.
    await sendEmail(to, subject, html, 'notifyOwnerOfNewClaim', {
      recipientUserId: await ownerUserId(supabase, claim.business_id),
    })
  } catch (error) {
    logger.error('notifyOwnerOfNewClaim failed', {
      action: 'notifyOwnerOfNewClaim',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

/**
 * "A customer sent you a message". The caller throttles (at most one per conversation per hour,
 * see sendMessageAction); this only sends.
 *
 * ponytail: its only caller runs in the consumer's request, where the lookup returns NULL, so
 * this sends nothing until a server-side sending identity exists (see the header). Kept wired so
 * that change turns it on; Settings does not promise this email meanwhile.
 */
export async function notifyOwnerOfNewMessage(claimId: string): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient()
    const to = await ownerEmail(supabase, claimId)
    if (!to) return

    const claim = await loadClaim(supabase, claimId)
    const { subject, html } = newMessageEmail({
      claimId,
      dealTitle: claim ? await dealTitle(supabase, claim) : null,
    })
    await sendEmail(to, subject, html, 'notifyOwnerOfNewMessage', {
      recipientUserId: claim
        ? await ownerUserId(supabase, claim.business_id)
        : undefined,
    })
  } catch (error) {
    logger.error('notifyOwnerOfNewMessage failed', {
      action: 'notifyOwnerOfNewMessage',
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
