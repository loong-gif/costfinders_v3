import Link from 'next/link'
import {
  getPublicRegularPrices,
  isMarketplaceFreshnessError,
  summarizeRegularPrices,
} from '@/lib/data/marketplace'

export const dynamic = 'force-dynamic'

function money(value: number) {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
}

export default async function PricesPage() {
  let comparisons: ReturnType<typeof summarizeRegularPrices>
  try {
    comparisons = summarizeRegularPrices(await getPublicRegularPrices())
  } catch (error) {
    if (isMarketplaceFreshnessError(error)) {
      return (
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#451a03]">Compare prices</h1>
          <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
            Regular-price comparisons are temporarily unavailable. Please try
            again later.
          </p>
        </main>
      )
    }
    throw error
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-[#451a03]">Compare prices</h1>
      <p className="mt-2 max-w-3xl text-[#78350f]">
        Regular prices from clinic service menus are grouped by city and service
        category. Units stay separate so comparisons stay apples-to-apples.
      </p>

      <div className="mt-8 space-y-5">
        {comparisons.map((comparison) => (
          <section
            key={`${comparison.city}-${comparison.serviceCategory}`}
            className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5"
          >
            <p className="text-sm font-medium text-[#92400e]">
              {comparison.city}
            </p>
            <h2 className="mt-1 text-xl font-semibold text-[#451a03]">
              {comparison.serviceCategory}
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {comparison.units.map((unit) => (
                <article
                  key={unit.unitType}
                  className="rounded-lg bg-[#faf5ee] p-4"
                >
                  <p className="font-medium capitalize text-[#451a03]">
                    Per {unit.unitType}
                  </p>
                  {unit.providerCount === 1 ? (
                    <p className="mt-2 text-sm text-[#78350f]">
                      Sample insufficient — one provider
                    </p>
                  ) : (
                    <p className="mt-2 text-lg font-semibold text-[#92400e]">
                      {money(unit.minimum)}–{money(unit.maximum)}
                    </p>
                  )}
                  {unit.median !== null && (
                    <p className="mt-1 text-sm text-[#78350f]">
                      Median {money(unit.median)}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-[#78350f]">
                    {unit.providerCount}{' '}
                    {unit.providerCount === 1 ? 'provider' : 'providers'}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>

      {comparisons.length === 0 && (
        <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
          No regular prices are available yet.{' '}
          <Link href="/promotions" className="underline">
            Browse promotions instead.
          </Link>
        </p>
      )}
    </main>
  )
}
