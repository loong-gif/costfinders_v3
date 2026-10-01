import { supabase } from '@/lib/supabase'
import { AdminDashboardClient } from './dashboardClient'

export const dynamic = 'force-dynamic'

/**
 * Exact row count, straight from Postgres.
 *
 * This used to be `(await getOffers()).length`, which reported 1000 for a 1931-row
 * table: PostgREST caps a plain select at 1000 rows, so the dashboard silently
 * under-counted every table it grew past. `head: true` transfers no rows at all.
 *
 * Returns `null` on failure so the card can say the number is unavailable rather
 * than showing a confident 0 — an admin moderates off these numbers.
 */
async function countRows(table: string): Promise<number | null> {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })

  return error ? null : (count ?? 0)
}

export default async function AdminDashboardPage() {
  // The public views, which the anon client may read: every business, and every live offer
  // (what the card says). The tables are closed to anon since 20260924050002.
  const [totalBusinesses, totalOffers] = await Promise.all([
    countRows('public_business_directory'),
    countRows('public_offers'),
  ])

  return (
    <AdminDashboardClient
      totalBusinesses={totalBusinesses}
      totalOffers={totalOffers}
    />
  )
}
