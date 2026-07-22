import Link from 'next/link'
import { getPublicBusinesses } from '@/lib/data/marketplace'

export const dynamic = 'force-dynamic'

export default async function BusinessesPage() {
  const businesses = await getPublicBusinesses()

  return (
    <main className="mx-auto max-w-7xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-3xl font-bold text-[#451a03]">Businesses</h1>
      <p className="mt-2 text-[#78350f]">
        Browse local medspa providers and their verified prices and promotions.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {businesses.map((business) => (
          <Link
            key={business.business_id}
            href={`/businesses/${business.business_id}`}
            className="rounded-xl border border-[#d4c4b0] bg-[#f2ebe2] p-5 transition-colors hover:bg-[#faf5ee]"
          >
            <h2 className="font-semibold text-[#451a03]">
              {business.name ?? 'Provider'}
            </h2>
            <p className="mt-1 text-sm text-[#78350f]">
              {business.category ?? 'Medspa'} ·{' '}
              {business.city ?? 'Location unavailable'}
            </p>
            <p className="mt-3 text-sm text-[#92400e]">
              {business.score ?? '—'} rating · {business.review_count ?? 0}{' '}
              reviews
            </p>
          </Link>
        ))}
      </div>
    </main>
  )
}
