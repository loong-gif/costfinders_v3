import Link from 'next/link'
import {
  getFreshnessLabel,
  getPublicPromotions,
  isMarketplaceFreshnessError,
} from '@/lib/data/marketplace'

export const dynamic = 'force-dynamic'

function PromotionUnavailable() {
  return (
    <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
      Recently verified promotions will appear here after the freshness data
      migration is applied.
    </p>
  )
}

export default async function PromotionsPage() {
  let promotions: Awaited<ReturnType<typeof getPublicPromotions>>
  try {
    promotions = await getPublicPromotions()
  } catch (error) {
    if (isMarketplaceFreshnessError(error)) {
      return (
        <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-[#451a03]">Promotions</h1>
          <PromotionUnavailable />
        </main>
      )
    }
    throw error
  }

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-[#451a03]">Promotions</h1>
      <p className="mt-2 text-[#78350f]">
        Recently verified discounts from local medspa providers.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {promotions.map((offer) => (
          <article
            key={offer.id}
            className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5"
          >
            <p className="text-sm text-[#92400e]">
              {offer.master_business_info?.name ?? 'Local provider'} ·{' '}
              {offer.master_business_info?.city ?? 'Location unavailable'}
            </p>
            <h2 className="mt-2 text-xl font-semibold text-[#451a03]">
              {offer.service_name ?? 'Promotion'}
            </h2>
            <p className="mt-3 text-2xl font-bold text-[#92400e]">
              ${offer.regular_price?.toLocaleString()}
              {offer.discountSignal === 'price' ? (
                <>
                  <span className="text-base font-normal"> → </span>$
                  {offer.discount_price?.toLocaleString()}
                </>
              ) : offer.discountSignal === 'percent' ? (
                <span className="text-base font-normal">
                  {' '}
                  · Save {offer.discount_percent}%
                </span>
              ) : (
                <span className="text-base font-normal">
                  {' '}
                  · ${offer.discount_amount} off
                </span>
              )}
            </p>
            <p className="mt-3 text-xs text-[#78350f]">
              {getFreshnessLabel(offer.last_verified_at)}
            </p>
            <div className="mt-5 flex gap-3 text-sm">
              <Link
                className="text-[#92400e] underline"
                href={`/businesses/${offer.business_id}`}
              >
                Business
              </Link>
              <a
                className="text-[#92400e] underline"
                href={`/go/offer/${offer.id}?from=promotions`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View offer source
              </a>
            </div>
          </article>
        ))}
      </div>

      {promotions.length === 0 && (
        <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
          No recently verified promotions are available yet.
        </p>
      )}
    </main>
  )
}
