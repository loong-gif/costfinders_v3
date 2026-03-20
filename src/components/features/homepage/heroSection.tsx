import Link from 'next/link'
import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'
import type { CategoryMapping } from '@/lib/data/categories'

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
        <div className="inline-flex items-center gap-2 bg-amber-400/10 border border-amber-400/20 rounded-full px-4 py-1.5 mb-6">
          <TrendUp size={16} weight="bold" className="text-amber-400" />
          <span className="text-sm text-amber-400 font-medium">
            {totalOffers} deals from {totalBusinesses} providers
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-stone-100 mb-5 leading-tight">
          Don&apos;t overpay for{' '}
          <span className="text-amber-400">medspa treatments</span>
        </h1>
        <p className="text-lg text-stone-400 mb-10 max-w-xl mx-auto">
          Compare real prices from verified providers. Find the best deals on
          Botox, fillers, facials, and more.
        </p>

        <Link href="/deals">
          <Button size="lg" className="text-base px-8 py-3.5">
            <MagnifyingGlass size={20} weight="bold" />
            Browse all deals
          </Button>
        </Link>

        {/* Category chips */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-8">
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/deals?category=${cat.slug}`}
              className="bg-stone-800/60 hover:bg-stone-800 border border-stone-800 hover:border-stone-700 text-stone-300 hover:text-stone-100 rounded-full px-4 py-1.5 text-sm transition-colors duration-200 cursor-pointer"
            >
              {cat.label}
              <span className="ml-1.5 text-stone-500">{cat.count}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
