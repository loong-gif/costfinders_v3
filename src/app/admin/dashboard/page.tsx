import { getBusinesses } from '@/lib/data/businesses'
import { getOffers } from '@/lib/data/offers'
import { AdminDashboardClient } from './dashboardClient'

export const dynamic = 'force-dynamic'

export default async function AdminDashboardPage() {
  // Fetch real counts from Supabase
  const [businesses, offers] = await Promise.all([getBusinesses(), getOffers()])

  return (
    <AdminDashboardClient
      totalBusinesses={businesses.length}
      totalOffers={offers.length}
    />
  )
}
