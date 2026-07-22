import {
  getPublicPriceQuotes,
  isMarketplaceFreshnessError,
} from '@/lib/data/marketplace'
import { PricesClient } from './pricesClient'

export const dynamic = 'force-dynamic'

interface PricesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PricesPage({ searchParams }: PricesPageProps) {
  try {
    const [quotes, params] = await Promise.all([
      getPublicPriceQuotes(),
      searchParams,
    ])

    return (
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#451a03]">Compare prices</h1>
        <p className="mt-2 max-w-3xl text-[#78350f]">
          Active offer item prices grouped by city and service category. When an
          item has no unit price, we fall back to the linked catalog regular
          price. Units stay separate so comparisons stay apples-to-apples.
        </p>

        <PricesClient quotes={quotes} initialSearchParams={params} />
      </main>
    )
  } catch (error) {
    if (isMarketplaceFreshnessError(error)) {
      return (
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#451a03]">Compare prices</h1>
          <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
            Price comparisons are temporarily unavailable. Please try again
            later.
          </p>
        </main>
      )
    }
    throw error
  }
}
