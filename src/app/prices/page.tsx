import { Suspense } from 'react'
import {
  getPublicPriceQuotes,
  isMarketplaceFreshnessError,
} from '@/lib/data/marketplace'
import { PricesClient } from './pricesClient'

export const dynamic = 'force-dynamic'

export default async function PricesPage() {
  try {
    const quotes = await getPublicPriceQuotes()

    return (
      <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-[#451a03]">Compare prices</h1>
        <p className="mt-2 max-w-3xl text-[#78350f]">
          Active offer item prices grouped by city and service category. When an
          item has no unit price, we fall back to the linked catalog regular
          price. Units stay separate so comparisons stay apples-to-apples.
        </p>

        <Suspense
          fallback={
            <p className="mt-8 text-[#78350f]">Loading price filters…</p>
          }
        >
          <PricesClient quotes={quotes} />
        </Suspense>
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
