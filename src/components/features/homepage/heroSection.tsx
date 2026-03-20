import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  categories: { slug: string; label: string; count: number }[]
  totalOffers: number
  totalBusinesses: number
}

export function HeroSection({
  categories,
  totalOffers,
  totalBusinesses,
}: HeroSectionProps) {
  return (
    <section className="py-16 sm:py-24">
      <div className="max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 bg-amber-800/8 border border-amber-800/15 rounded-full px-4 py-1.5 mb-6">
          <TrendUp size={16} weight="bold" className="text-amber-800" />
          <span className="text-sm text-amber-800 font-medium">
            {totalOffers} deals from {totalBusinesses} providers
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#451a03] mb-5 leading-tight">
          Don&apos;t overpay for{' '}
          <span className="text-amber-800">medspa treatments</span>
        </h1>
        <p className="text-lg text-[#78350f] mb-10 max-w-xl mx-auto">
          Compare real prices from verified providers. Find the best deals on
          Botox, fillers, facials, and more.
        </p>

        <Link href="/deals">
          <Button size="lg" className="text-base px-8 py-3.5">
            <MagnifyingGlass size={20} weight="bold" />
            Find deals near you
          </Button>
        </Link>

        {/* Category chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/treatments/${cat.slug}`}
              className="bg-[#faf5ee]/60 hover:bg-[#faf5ee] border border-[#d4c4b0] hover:border-[#c4b09a] text-[#6b3410] hover:text-[#451a03] rounded-full px-4 py-1.5 text-sm transition-colors duration-200 cursor-pointer"
            >
              {cat.label}
              <span className="ml-1.5 text-[#92400e]">{cat.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
