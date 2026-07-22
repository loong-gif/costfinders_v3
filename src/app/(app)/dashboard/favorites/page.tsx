import { getSavedDealsWithDetailsAction } from '@/lib/actions/saved-deals'
import { FavoritesClient } from './favoritesClient'

export default async function FavoritesPage() {
  const result = await getSavedDealsWithDetailsAction()
  const initialDeals = result.success && result.deals ? result.deals : []

  return <FavoritesClient initialDeals={initialDeals} />
}
