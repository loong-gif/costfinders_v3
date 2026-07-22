import { Globe } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  getFreshnessLabel,
  getPublicBusiness,
  isMarketplaceFreshnessError,
} from '@/lib/data/marketplace'

export const dynamic = 'force-dynamic'

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  let profile: Awaited<ReturnType<typeof getPublicBusiness>>
  try {
    profile = await getPublicBusiness(Number(id))
  } catch (error) {
    if (isMarketplaceFreshnessError(error)) {
      return (
        <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
          <Link href="/businesses" className="text-sm text-[#92400e] underline">
            Back to businesses
          </Link>
          <p className="mt-8 rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-6 text-[#78350f]">
            This profile&apos;s verified price data will appear after the
            freshness data migration is applied.
          </p>
        </main>
      )
    }
    throw error
  }
  if (!profile) notFound()

  const { business, promotions, regularPrices } = profile
  return (
    <main className="mx-auto max-w-5xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <Link href="/businesses" className="text-sm text-[#92400e] underline">
        Back to businesses
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-[#451a03]">
        {business.name}
      </h1>
      <p className="mt-2 text-[#78350f]">
        {business.category} · {business.address ?? business.city} ·{' '}
        {business.score ?? '—'} rating
      </p>
      {business.website && (
        <a
          href={`/go/business/${business.business_id}?from=business_profile`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 text-[#92400e] underline"
        >
          <Globe size={18} />
          Visit website
        </a>
      )}

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-[#451a03]">
          Regular prices
        </h2>
        <div className="mt-4 space-y-3">
          {regularPrices.map((offer) => (
            <div
              key={offer.id}
              className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-4"
            >
              <span className="font-medium text-[#451a03]">
                {offer.service_name}
              </span>
              <span className="ml-3 text-[#92400e]">
                ${offer.regular_price} / {offer.unit_type}
              </span>
              <p className="mt-1 text-xs text-[#78350f]">
                {getFreshnessLabel(offer.last_verified_at)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold text-[#451a03]">
          Current promotions
        </h2>
        <div className="mt-4 space-y-3">
          {promotions.map((offer) => (
            <a
              key={offer.id}
              href={`/go/offer/${offer.id}?from=business_profile`}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-4"
            >
              <span className="font-medium text-[#451a03]">
                {offer.service_name}
              </span>
              <span className="ml-3 text-[#92400e]">
                ${offer.regular_price}{' '}
                {offer.discountSignal === 'price'
                  ? `→ $${offer.discount_price}`
                  : offer.discountSignal === 'percent'
                    ? `· Save ${offer.discount_percent}%`
                    : `· $${offer.discount_amount} off`}
              </span>
            </a>
          ))}
        </div>
      </section>
    </main>
  )
}
