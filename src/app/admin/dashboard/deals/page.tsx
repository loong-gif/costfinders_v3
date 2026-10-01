import { redirect } from 'next/navigation'
import type { AdminDeal } from '@/components/features/dealModeration/dealModerationCard'
import { requireAdmin } from '@/lib/auth/guards'
import { offerToAnonymousDeal, priceDefects } from '@/lib/data/adapters'
import { getOffersWithBusinessIdentity } from '@/lib/data/offers'
import { logSupabaseError } from '@/lib/logger'
import { DealModerationClient } from './dealsClient'

export const dynamic = 'force-dynamic'

export default async function DealModerationPage() {
  // requireAdmin() for the AUTHENTICATED server client, not the anon singleton. This queue is
  // the one caller that reads delisted offers, and promo_offer_items' anon policy only exposes
  // items whose parent offer is active — so on the anon client all 214 delisted-but-priced
  // offers arrived with an empty item array, which flattenOffer() resolves to a null title
  // (falling back to the whole scraped paragraph) and a null category (which
  // dbCategoryToTreatment maps to 'body'): 214 identical "Body" cards titled with prose. The
  // admin read policy added in 20260909190003 tests is_admin(), so it can only pass on a request
  // carrying an admin's session cookies.
  //
  // The gate is here rather than only in the layout because this route's layout is a CLIENT
  // component: its redirect runs after this Server Component has already queried and streamed
  // every business name, address and website in the RSC payload. requireAdmin() is the project's
  // one authority (public.is_admin() against admin_profiles, never user_metadata), and without
  // it this fix would be non-deterministic anyway — a non-admin request fails is_admin() and
  // silently gets the broken 214 "Body" cards back.
  const admin = await requireAdmin().catch(() => null)
  if (!admin) redirect('/admin')

  // Every offer in the table, unfiltered. The pricing filter that consumer browse applies
  // ("hide deals with no pricing data") used to reach this call too, which left 424 unpriced
  // offers — including any deal an owner submits with a percentage discount and no dollar
  // figure — invisible here as well as on the public site: pending review forever, on no
  // screen anyone could act from. It is now scoped to the consumer path in
  // _getOffersWithBusinesses, so this queue sees everything awaiting moderation regardless of
  // price, and everything already live regardless of whether it can still be taken down.
  //
  // ponytail: 1125 rows today and no server-side paging. Not a truncation risk —
  // _getOffersWithBusinesses pages past PostgREST's 1000-row cap rather than silently
  // stopping — but it is one unbounded read, and the moderator needs the whole set precisely
  // because a take-down has to be able to reach any live offer. The bound is on the DOM
  // instead (CARDS_PER_PAGE in dealsClient). Move to `.range()` here if the table reaches a
  // few thousand.
  const [offers, owners] = await Promise.all([
    getOffersWithBusinessIdentity(admin.supabase),
    admin.supabase
      .from('business_profiles')
      .select('business_id')
      .eq('claim_status', 'approved'),
  ])
  if (owners.error) logSupabaseError('DealModerationPage.owners', owners.error)

  // Only an approved owner can insert a deal (the INSERT policy), and the owner form sets no
  // promotion and no membership, while every pipeline row carries exactly one (checked live
  // 2026-09-24: 0 exceptions among owned businesses). promo_offer_master has no creator or
  // source column, so this is the tell. ponytail: inferred, not recorded; add a `source`
  // column if owner deals ever gain a promotion.
  const ownedBusinessIds = new Set(
    (owners.data ?? []).map((row) => Number(row.business_id)),
  )

  // The consumer adapter's output plus the two admin-only fields, so the moderator sees the
  // price exactly as the site prints it. This used to be a hand copy of offerToAnonymousDeal,
  // and it drifted: it still fell back to regular_price for a missing deal price (the bug the
  // adapter removed — the full price shown as the deal) and still carried `unit_type`, which
  // printed "$299 unit" for a 40-unit package. A copy cannot drift if there is no copy.
  // The AnonymousDeal-only fields (locationArea, businessRating…) ride along unused.
  //
  // No moderationStatus/moderationNotes: the pipeline dropped both columns on 2026-09-15.
  // `isActive` is the whole publication state now — see dealModerationCard.tsx.
  const deals: AdminDeal[] = offers.map((offer) => ({
    ...offerToAnonymousDeal(offer),
    businessId: String(offer.business_id ?? 0),
    businessName: offer.master_business_info?.name ?? undefined,
    defects: priceDefects(offer),
    // Owner-submitted and never published: an owner deal cannot pass the publish guard (no
    // line items, no promotion), so an inactive one has by construction never been live.
    awaitingFirstReview:
      offer.is_active !== true &&
      offer.promotion_id == null &&
      offer.membership_plan_id == null &&
      ownedBusinessIds.has(Number(offer.business_id)),
    editable: {
      title: offer.service_name ?? offer.offer_raw_text ?? '',
      discountPrice: offer.discount_price,
      regularPrice: offer.regular_price,
      priceModel: offer.price_model,
      deliveredUnits: offer.item_count === 1 ? offer.delivered_units : null,
      itemCount: offer.item_count,
    },
  }))

  return <DealModerationClient initialDeals={deals} />
}
