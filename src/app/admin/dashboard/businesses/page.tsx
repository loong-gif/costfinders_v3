import type { AdminBusinessRow } from '@/components/features/admin/businessTable'
import { requireAdmin } from '@/lib/auth/guards'
import { logSupabaseError } from '@/lib/logger'
import type { BusinessTier } from '@/types/business'
import { BusinessesManagementClient } from './businessesClient'

export const dynamic = 'force-dynamic'

export default async function BusinessesManagementPage() {
  // proxy.ts already gates /admin/dashboard/* on is_admin(), but this page needs an
  // authenticated client of its own: business_profiles SELECT is (auth.uid() = id) OR
  // private.is_admin(), so the anon singleton behind getBusinesses() reads it as empty.
  const { supabase } = await requireAdmin()

  // Read here rather than through getBusinesses(), which selects the public columns only: the
  // contact editor needs phone and website. 419 rows today, under PostgREST's 1000-row page.
  const [{ data: supaBusinesses, error: businessError }, { data: profiles }] =
    await Promise.all([
      supabase
        .from('master_business_info')
        .select(
          'business_id, name, address, city, phone, website, score, review_count',
        )
        .order('name'),
      supabase
        .from('business_profiles')
        .select('business_id, tier, claim_status')
        .eq('claim_status', 'approved'),
    ])
  if (businessError) {
    logSupabaseError('BusinessesManagementPage', businessError)
    throw businessError
  }

  // Tier used to be the literal 'unclaimed' for all 419 rows, so New Look Skin Center —
  // claimed, approved, tier 'free' — rendered as Unclaimed and the Free/Paid tabs read 0
  // permanently. It is real now. A business with no approved claim genuinely is unclaimed,
  // which is why the fallback is honest rather than a placeholder.
  const tierByBusinessId = new Map<string, BusinessTier>()
  for (const profile of profiles ?? []) {
    if (profile.business_id == null) continue
    const tier = profile.tier
    if (tier === 'free' || tier === 'paid') {
      tierByBusinessId.set(String(profile.business_id), tier)
    }
  }

  const businesses: AdminBusinessRow[] = (supaBusinesses ?? []).map((biz) => {
    const id = String(biz.business_id)
    return {
      id,
      name: biz.name ?? 'Unknown business',
      city: biz.city ?? '',
      tier: tierByBusinessId.get(id) ?? 'unclaimed',
      rating: biz.score ?? 0,
      reviewCount: biz.review_count ?? 0,
      phone: biz.phone ?? null,
      website: biz.website ?? null,
      address: biz.address ?? null,
    }
  })

  return <BusinessesManagementClient initialBusinesses={businesses} />
}
