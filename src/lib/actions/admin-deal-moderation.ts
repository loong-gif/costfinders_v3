'use server'

import { revalidatePath } from 'next/cache'
import { after } from 'next/server'
import { logAdminAction } from '@/lib/actions/audit'
import { createNotificationAction } from '@/lib/actions/notification-actions'
import { requireAdmin } from '@/lib/auth/guards'
import { offerTreatmentRoute } from '@/lib/data/adapters'
import { getCategorySlug } from '@/lib/data/categories'
import { resolveOfferTitle } from '@/lib/data/offers'
import { cityToSlug, getUnifiedCities } from '@/lib/data/unified'
import { sendEmail } from '@/lib/email/send'
import { publicErrorMessage } from '@/lib/errors/publicMessage'
import { logger, logSupabaseError } from '@/lib/logger'
import { getStates } from '@/lib/mock-data/states'
import type { ClinicServiceCategory } from '@/types/supabase'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ModerationResult {
  success: boolean
  error?: string
  /** The write landed, but something the admin should know about happened with it. */
  warning?: string
}

type AdminClient = Awaited<ReturnType<typeof requireAdmin>>['supabase']

/** The post-write state of a deal, as returned by every update in this file. */
interface DealRow {
  business_id: number | null
  is_active: boolean | null
  promotion_id: number | null
  membership_plan_id: number | null
  offer_raw_text: string | null
  promo_offer_items:
    | {
        offer_item_id: number
        item_name: string | null
        clinic_services: {
          service_category: ClinicServiceCategory | null
        } | null
      }[]
    | null
  master_business_info: { city: string | null } | null
}

/**
 * What the admin needs back from a deal write: its real publication state, what the publish
 * guard looks at, its title, and the category and city that name its public pages.
 */
const DEAL_ROW_SELECT = `business_id, is_active, promotion_id, membership_plan_id, offer_raw_text,
  promo_offer_items(offer_item_id, item_name, clinic_services(service_category)),
  master_business_info!fk_offer_business(city)`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Authorize the caller as an admin.
 *
 * requireAdmin() (src/lib/auth/guards.ts) is the project's one authority — public.is_admin()
 * against admin_profiles, which is the same function every RLS policy on this table uses, and
 * never user_metadata. It throws; every action here returns a result object, so the throw is
 * translated once, here, rather than in four catch blocks.
 *
 * This replaces a per-file verifyAdmin() that did the same rpc('is_admin') call by hand. Two
 * copies of an authorization check is one copy too many: the version this file used to carry
 * had already drifted once, gating on an admin_profiles.role value the column's CHECK
 * constraint did not permit, which made deal moderation unreachable for every account that
 * could exist.
 */
async function adminSession(): Promise<
  | { authorized: true; supabase: AdminClient; userId: string }
  | { authorized: false; error: string }
> {
  try {
    const { supabase, user } = await requireAdmin()
    return { authorized: true, supabase, userId: user.id }
  } catch (error) {
    return {
      authorized: false,
      error: error instanceof Error ? error.message : 'Unauthorized',
    }
  }
}

/**
 * Apply a moderation write and PROVE it landed.
 *
 * PostgREST answers an UPDATE that RLS filtered down to zero rows with `error: null` and no
 * rows — a silent no-op. Every action in this file used to read that as success and go on to
 * tell the admin, the owner and the audit log that the deal had been moderated. Returning the
 * row makes the write observed rather than assumed.
 *
 * The returned row is also the deal's real post-write state, so the owner's message can be
 * worded from what is true rather than from what the caller intended — see approveDealAction,
 * where "your deal is now live" is only true if the listing is actually on.
 */
async function updateDeal(
  supabase: AdminClient,
  dealId: number,
  patch: Record<string, unknown>,
  action: string,
): Promise<{ deal: DealRow } | { error: string }> {
  const { data, error } = await supabase
    .from('promo_offer_master')
    .update(patch)
    .eq('id', dealId)
    .select(DEAL_ROW_SELECT)
    .maybeSingle()

  if (error) {
    logSupabaseError(action, error, { dealId })
    // chk_promo_has_discount says a row may only be active if it records a discount — a
    // discount_price, discount_percent or discount_amount above zero. 61 of the 354 offers
    // currently off the site record none of the three, so "put it back on the site" is a
    // legitimate 23514 for them rather than a fault in this action, and the raw Postgres
    // string is not something to put in front of a moderator.
    if (
      error.code === '23514' &&
      error.message.includes('chk_promo_has_discount')
    ) {
      return {
        error:
          "This deal can't go back on the site until it records a discount — a discounted price, a percentage or an amount.",
      }
    }
    return { error: publicErrorMessage(error, "We couldn't update this deal.") }
  }
  if (!data) {
    logger.error('Moderation update matched no rows', { action, dealId })
    return {
      error: 'That deal could not be updated. It may have been removed.',
    }
  }
  return { deal: data as unknown as DealRow }
}

/**
 * The business owner behind a deal, or null when there is no owner account to tell.
 *
 * Most of the table is pipeline-ingested and belongs to a business nobody has claimed, so a
 * null here is the normal case, not an error.
 */
async function dealOwner(
  supabase: AdminClient,
  deal: DealRow,
): Promise<{ id: string; name: string; email: string | null } | null> {
  if (!deal.business_id) return null

  const { data: owner } = await supabase
    .from('business_profiles')
    .select('id, email, first_name')
    .eq('business_id', deal.business_id)
    .maybeSingle()

  if (!owner) return null
  return {
    id: owner.id,
    name: owner.first_name ?? 'there',
    email: owner.email,
  }
}

/**
 * Deliver a moderation outcome to the owner. Best-effort in both channels: the moderation
 * write has already landed and must not be undone by a mail or notification failure.
 *
 * This used to be copy-pasted into approve and reject and was simply ABSENT from
 * requestDealChanges — which is how the softest of the three outcomes became the one that
 * reached nobody. The admin typed out exactly what needed fixing and it was stored in a column
 * only admins can read.
 */
/**
 * `email` is currently never passed: the only two templates that filled it
 * (dealApprovalEmail / dealRejectionEmail in src/lib/email/templates.ts) described a verdict
 * this product no longer has, and both are now unreferenced. The parameter stays because
 * publishing a deal is a reasonable thing to email an owner about — but writing that template
 * is a decision about what CostFinders promises, not a refactor, so it is not made here.
 */
function notifyOwner(
  owner: { id: string; email: string | null },
  notification: { type: string; title: string; body: string },
  email?: { subject: string; html: string },
): void {
  createNotificationAction(
    owner.id,
    notification.type,
    notification.title,
    notification.body,
    '/business/dashboard/deals',
  ).catch(() => {})

  if (owner.email && email) {
    // after(), not a floating `.catch(() => {})` — see sendEmail's docblock. The moderation
    // write has landed; sendEmail logs any failure under this action name.
    const recipient = owner.email
    const { subject, html } = email
    // owner.id is business_profiles.id, the owner's auth user id: the opt-out check needs it.
    after(() =>
      sendEmail(recipient, subject, html, 'notifyOwner', {
        recipientUserId: owner.id,
      }),
    )
  }
}

/**
 * Why the database kept a deal off the site after an admin asked to publish it.
 *
 * prevent_incomplete_offer_activation() is a BEFORE trigger with no admin short-circuit: it
 * quietly sets is_active back to false unless the offer has at least one promo_offer_items row,
 * exactly one of a live promotion or a membership, and a price that matches its line item. An
 * owner-created deal has no items and no promotion, so it can never pass. The UPDATE succeeds
 * either way, which is how this action used to report "back on the site" (and tell the owner so)
 * for a deal that never went live.
 */
function publishRefusal(deal: DealRow): string {
  const why =
    (deal.promo_offer_items ?? []).length === 0
      ? 'it has no treatment line items'
      : deal.promotion_id == null && deal.membership_plan_id == null
        ? "it isn't attached to a promotion or a membership"
        : "its promotion has ended, or its price doesn't match its line item"
  return `The database kept this deal off the site because ${why}. It has not been published, and the owner was not told anything. The data team can add what's missing.`
}

/**
 * Refresh every public page that lists this deal, so a take-down leaves the site now rather
 * than when the hourly ISR window runs out.
 *
 * Paths come from the same helpers the pages use: getCategorySlug for /treatments/[category],
 * offerTreatmentRoute for /deals/[treatment]/[city], cityToSlug plus the unified city → state
 * map for /[state]/[city]. Best effort: a failed city lookup is logged, and the page still
 * refreshes on its own within the hour.
 */
async function revalidatePublicDealPages(
  dealId: number,
  deal: DealRow,
): Promise<void> {
  revalidatePath('/')
  revalidatePath('/deals')
  revalidatePath(`/deals/${dealId}`)

  const category =
    [...(deal.promo_offer_items ?? [])]
      .sort((a, b) => a.offer_item_id - b.offer_item_id)
      .find((item) => item.clinic_services?.service_category)?.clinic_services
      ?.service_category ?? null
  const browseSlug = getCategorySlug(category)
  if (browseSlug) revalidatePath(`/treatments/${browseSlug}`)

  const city = deal.master_business_info?.city?.trim()
  if (!city) return
  const citySlug = cityToSlug(city)
  revalidatePath(`/deals/${citySlug}`)
  const treatment = offerTreatmentRoute(category)
  if (treatment) revalidatePath(`/deals/${treatment}/${citySlug}`)

  try {
    const cities = await getUnifiedCities()
    const stateCode = cities.find((c) => c.slug === citySlug)?.stateCode
    const state = getStates().find((s) => s.code === stateCode)
    if (state) revalidatePath(`/${state.slug}/${citySlug}`)
  } catch (error) {
    logger.warn('Could not resolve the city page to refresh', {
      action: 'revalidatePublicDealPages',
      dealId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function unexpected(action: string, error: unknown): ModerationResult {
  logger.error(`${action} failed`, {
    action,
    error: error instanceof Error ? error.message : String(error),
  })
  return { success: false, error: 'An unexpected error occurred.' }
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * WHAT USED TO BE HERE
 *
 * approveDealAction / rejectDealAction / requestDealChangesAction, which wrote
 * `moderation_status` and `moderation_notes`. The ingestion pipeline dropped both columns on
 * 2026-09-15 (`drop_promo_offer_moderation_columns`) and removed the moderation clause from
 * the public SELECT policy at the same time, so all three would now fail with 42703 — and
 * every exported async function in a `'use server'` module is a public HTTP endpoint whether
 * or not any client imports it, so leaving them would leave three reachable endpoints that
 * can only error.
 *
 * Review collapsed onto the one publication switch the schema still has: is_active, written
 * by setDealListingAction below. An owner's deal now starts inactive
 * (supabase/migrations/20260916010001_owner_deals_start_inactive.sql) and an admin publishes
 * it from the same control that takes one down.
 */

/**
 * Take a deal off the site, or put it back — sets is_active.
 *
 * The moderation queue had no write of any kind against a deal that was already approved, and
 * every one of the 1125 pipeline-ingested offers defaults to approved. An admin who spotted an
 * unlawful or plainly wrong offer had no control anywhere in the product to remove it, while
 * the database had permitted the update all along: policy "Admins can update deal moderation"
 * is FOR UPDATE with both USING and WITH CHECK = private.is_admin(), which covers every column
 * rather than only the moderation ones, and `authenticated` still holds the UPDATE grant on
 * promo_offer_master. No migration was needed; the gap was entirely in the UI.
 *
 * Writes is_active and nothing else. In particular it does not touch moderation_notes, which
 * on 125 rows holds ingestion provenance ("Public source page verified 2026-09-10") rather
 * than reviewer text — a take-down must not erase the record of where a price came from.
 * Leaving moderation_status alone is also what makes this reversible: pass isActive true to
 * put the deal straight back.
 */
export async function setDealListingAction(
  dealId: number,
  isActive: boolean,
): Promise<ModerationResult> {
  try {
    const admin = await adminSession()
    if (!admin.authorized) return { success: false, error: admin.error }

    const result = await updateDeal(
      admin.supabase,
      dealId,
      { is_active: isActive },
      'setDealListingAction',
    )
    if ('error' in result) return { success: false, error: result.error }

    revalidatePath('/admin/dashboard/deals')

    // The write "succeeded" but the publish guard may have kept the row inactive. Report what
    // the row says, not what was asked, and tell nobody else anything.
    if (result.deal.is_active !== isActive) {
      logger.warn('Publish request left the deal inactive', {
        action: 'setDealListingAction',
        dealId,
      })
      return { success: false, error: publishRefusal(result.deal) }
    }

    await revalidatePublicDealPages(dealId, result.deal)

    const owner = await dealOwner(admin.supabase, result.deal)
    if (owner) {
      const title = resolveOfferTitle(result.deal) ?? `Deal #${dealId}`
      // Notification only. There is no take-down email template, and the two that exist both
      // say the deal was reviewed — which this is not.
      notifyOwner(owner, {
        type: isActive ? 'deal_relisted' : 'deal_delisted',
        title: isActive ? 'Deal is back on the site' : 'Deal taken down',
        body: isActive
          ? `Your deal "${title}" is showing on CostFinders again.`
          : `Your deal "${title}" has been taken down and is no longer showing on CostFinders.`,
      })
    }

    await logAdminAction(
      isActive ? 'deal_relisted' : 'deal_delisted',
      'deal',
      String(dealId),
    )
    return { success: true }
  } catch (error) {
    return unexpected('setDealListingAction', error)
  }
}

/** The fields an admin can correct on a deal. Re-validated server-side. */
export interface DealEditInput {
  title: string
  discountPrice: number | null
  regularPrice: number | null
  priceModel: string
  /** Applied only when the offer has exactly one line item; see offerPriceBasis. */
  deliveredUnits: number | null
}

const PRICE_MODELS = ['total', 'per_unit', 'from'] as const
const TITLE_MAX_CHARS = 200
/** promo_offer_items.delivered_units is smallint. */
const MAX_UNITS = 32767

const TITLE_MIGRATION_PENDING =
  'needs database migration 20260924020002, which has not been applied yet'

function priceOrError(
  value: unknown,
  label: string,
): { price: number | null } | { error: string } {
  if (value == null || value === '') return { price: null }
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) {
    return { error: `${label} must be a dollar amount of $0 or more.` }
  }
  return { price: Math.round(n * 100) / 100 }
}

/** Postgres refusals of a price edit, in words. */
function priceEditError(error: { code?: string; message: string }): string {
  const m = error.message
  if (m.includes('chk_discount_leq_regular')) {
    return "The deal price can't be higher than the regular price."
  }
  if (m.includes('regular_price_gt_0')) {
    return 'The regular price must be more than $0, or left empty.'
  }
  if (m.includes('chk_promo_has_discount')) {
    return 'A deal on the site must record a discount: a deal price, a percentage or an amount off.'
  }
  if (m.includes('discount invariant')) {
    return "That price doesn't match the deal's line item, so the database refused it."
  }
  return publicErrorMessage(error, "We couldn't save that price.")
}

/**
 * Correct a deal's title, prices, price type and unit count.
 *
 * - Title: `item_name` of the lowest offer_item_id (the canonical title rule in offers.ts), or
 *   `offer_raw_text` when the offer has no items (owner-created deals).
 * - Prices and price_model: promo_offer_master, which the admin UPDATE policy already covers.
 * - Units: `delivered_units` on the single item, and only when there is exactly one, because a
 *   bundle's unit count is not what its price buys.
 *
 * Two writes, not one transaction: prices first, then the item. If the second is refused the
 * first stays, and the message says exactly which part saved. Every write is selected back.
 *
 * Triggers may take a live deal off the site when its price and line item disagree
 * (deactivate_offer_with_unresolved_item). The final read reports that rather than hiding it.
 */
export async function updateDealDetailsAction(
  dealId: number,
  input: DealEditInput,
): Promise<ModerationResult> {
  try {
    const admin = await adminSession()
    if (!admin.authorized) return { success: false, error: admin.error }
    const { supabase } = admin

    if (!Number.isInteger(dealId)) {
      return { success: false, error: 'That is not a deal id.' }
    }
    const title = typeof input?.title === 'string' ? input.title.trim() : ''
    if (!title || title.length > TITLE_MAX_CHARS) {
      return {
        success: false,
        error: `The title must be 1 to ${TITLE_MAX_CHARS} characters.`,
      }
    }
    const discount = priceOrError(input.discountPrice, 'The deal price')
    if ('error' in discount) return { success: false, error: discount.error }
    const regular = priceOrError(input.regularPrice, 'The regular price')
    if ('error' in regular) return { success: false, error: regular.error }
    if (
      !PRICE_MODELS.includes(input.priceModel as (typeof PRICE_MODELS)[number])
    ) {
      return { success: false, error: 'Pick a price type from the list.' }
    }
    const units = input.deliveredUnits
    if (
      units != null &&
      (!Number.isInteger(units) || units < 1 || units > MAX_UNITS)
    ) {
      return {
        success: false,
        error: 'Units must be a whole number of 1 or more, or left empty.',
      }
    }

    const { data: before, error: readError } = await supabase
      .from('promo_offer_master')
      .select(
        'is_active, discount_price, regular_price, price_model, offer_raw_text, promo_offer_items(offer_item_id, item_name, delivered_units)',
      )
      .eq('id', dealId)
      .maybeSingle()
    if (readError) {
      logSupabaseError('updateDealDetailsAction.read', readError, { dealId })
      return {
        success: false,
        error: publicErrorMessage(readError, "We couldn't read this deal."),
      }
    }
    if (!before) {
      return { success: false, error: 'That deal could not be found.' }
    }

    const items = [
      ...((before.promo_offer_items ?? []) as {
        offer_item_id: number
        item_name: string | null
        delivered_units: number | null
      }[]),
    ].sort((a, b) => a.offer_item_id - b.offer_item_id)
    const titleItem = items[0] ?? null

    const masterPatch: Record<string, unknown> = {}
    if (discount.price !== before.discount_price)
      masterPatch.discount_price = discount.price
    if (regular.price !== before.regular_price)
      masterPatch.regular_price = regular.price
    if (input.priceModel !== before.price_model)
      masterPatch.price_model = input.priceModel
    if (!titleItem && title !== before.offer_raw_text)
      masterPatch.offer_raw_text = title

    const itemPatch: Record<string, unknown> = {}
    if (titleItem && title !== titleItem.item_name) itemPatch.item_name = title
    if (
      items.length === 1 &&
      titleItem &&
      units !== titleItem.delivered_units
    ) {
      itemPatch.delivered_units = units
    }

    const changed = [...Object.keys(masterPatch), ...Object.keys(itemPatch)]
    if (changed.length === 0) {
      return {
        success: true,
        warning: 'Nothing had changed, so nothing was saved.',
      }
    }

    if (Object.keys(masterPatch).length > 0) {
      const { data, error } = await supabase
        .from('promo_offer_master')
        .update(masterPatch)
        .eq('id', dealId)
        .select('id')
      if (error) {
        logSupabaseError('updateDealDetailsAction.master', error, { dealId })
        return { success: false, error: priceEditError(error) }
      }
      if (!data || data.length === 0) {
        return {
          success: false,
          error: 'That deal was not updated. It may have been removed.',
        }
      }
    }

    const warnings: string[] = []
    if (titleItem && Object.keys(itemPatch).length > 0) {
      const { data, error } = await supabase
        .from('promo_offer_items')
        .update(itemPatch)
        .eq('offer_item_id', titleItem.offer_item_id)
        .select('offer_item_id')
      if (error) {
        logSupabaseError('updateDealDetailsAction.item', error, { dealId })
      }
      // 42501 = no column grant; zero rows = no UPDATE policy. Both mean the migration.
      if (error || !data || data.length === 0) {
        const reason =
          !error || error.code === '42501'
            ? TITLE_MIGRATION_PENDING
            : priceEditError(error)
        const savedPrices = Object.keys(masterPatch).length > 0
        if (!savedPrices) {
          return {
            success: false,
            error: `The title and units were not saved: this ${reason}.`,
          }
        }
        warnings.push(
          `The prices were saved, but the title and units were not: this ${reason}.`,
        )
      }
    }

    const { data: after, error: afterError } = await supabase
      .from('promo_offer_master')
      .select(DEAL_ROW_SELECT)
      .eq('id', dealId)
      .maybeSingle()
    if (afterError) {
      logSupabaseError('updateDealDetailsAction.after', afterError, { dealId })
    }
    const deal = after as unknown as DealRow | null
    if (deal && before.is_active && deal.is_active === false) {
      warnings.push(
        'The database took the deal off the site because its price and its line item no longer agree. Check the price, then put it back.',
      )
    }

    revalidatePath('/admin/dashboard/deals')
    if (deal) await revalidatePublicDealPages(dealId, deal)
    await logAdminAction('deal_edited', 'deal', String(dealId), {
      fields: changed.join(', '),
    })

    return {
      success: true,
      warning: warnings.length > 0 ? warnings.join(' ') : undefined,
    }
  } catch (error) {
    return unexpected('updateDealDetailsAction', error)
  }
}
