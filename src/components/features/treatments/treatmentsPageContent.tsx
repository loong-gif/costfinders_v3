'use client'

import {
  ArrowRight,
  Drop,
  Leaf,
  Lightning,
  Person,
  Sparkle,
  Storefront,
  Syringe,
  Tag,
} from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ScrollRevealItem } from '@/components/patterns/scrollReveal'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'

const categoryIcons: Record<string, React.ReactNode> = {
  Syringe: <Syringe size={24} weight="fill" className="text-amber-800" />,
  Drop: <Drop size={24} weight="fill" className="text-amber-800" />,
  Sparkle: <Sparkle size={24} weight="fill" className="text-amber-800" />,
  Lightning: <Lightning size={24} weight="fill" className="text-amber-800" />,
  Person: <Person size={24} weight="fill" className="text-amber-800" />,
  Leaf: <Leaf size={24} weight="fill" className="text-amber-800" />,
}

const slugToIcon: Record<string, string> = {
  neurotoxins: 'Syringe',
  fillers: 'Drop',
  'facials-lasers': 'Sparkle',
  wellness: 'Leaf',
  consultations: 'Person',
  other: 'Lightning',
}

function CategoryCard({
  category,
}: {
  category: { slug: string; label: string; count: number }
}) {
  const iconName = slugToIcon[category.slug] || 'Lightning'
  const icon = categoryIcons[iconName] || (
    <Tag size={24} weight="fill" className="text-amber-800" />
  )

  return (
    <Link
      href={`/treatments/${category.slug}`}
      className="group relative bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl p-5 transition-all duration-300 hover:border-[#c4b09a] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(69,26,3,0.12)] overflow-hidden"
    >
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-800 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-800/8 group-hover:bg-amber-800/15 flex items-center justify-center transition-colors duration-300">
            {icon}
          </div>
          <h3 className="font-semibold text-lg text-[#451a03] group-hover:text-amber-800 transition-colors duration-300">
            {category.label}
          </h3>
        </div>
        <ArrowRight
          size={20}
          weight="light"
          className="text-[#92400e] group-hover:text-amber-800 group-hover:translate-x-1 transition-all duration-300"
        />
      </div>

      <div className="mt-4 pt-4 border-t border-[#d4c4b0] flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Tag size={16} weight="light" className="text-amber-800" />
          <span>{category.count} deals</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Storefront size={16} weight="light" className="text-amber-800" />
          <span>{Math.ceil(category.count / 2)} providers</span>
        </div>
      </div>
    </Link>
  )
}

interface TreatmentsPageContentProps {
  categories: { slug: string; label: string; count: number }[]
  totalDeals: number
}

export function TreatmentsPageContent({
  categories,
  totalDeals,
}: TreatmentsPageContentProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <main className="min-h-screen pt-16 pb-0">
      {/* Hero — full-bleed with image background */}
      <section className="relative w-full overflow-hidden">
        <Image
          src="/images/treatments-hero.webp"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#451a03]/75 via-[#451a03]/50 to-[#e8ddd0]"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
          <Breadcrumb
            items={[{ label: 'Home', href: '/' }, { label: 'Treatments' }]}
            className="mb-6 [&_a]:text-white/70 [&_a:hover]:text-white [&_span]:text-white/90 [&_svg]:text-white/50"
          />

          <h1
            className={`text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4 transition-all duration-700 delay-100 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            Browse <span className="text-amber-300">treatments</span>
          </h1>
          <p
            className={`text-lg text-white/80 max-w-2xl mb-8 transition-all duration-700 delay-300 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            Explore our curated categories of aesthetic treatments. Compare
            prices from verified medspa providers.
          </p>

          <div
            className={`inline-flex items-center gap-6 bg-white/10 backdrop-blur-sm border border-white/15 rounded-full px-5 py-2 transition-all duration-700 delay-500 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}
          >
            <div className="flex items-center gap-2">
              <Tag size={18} weight="bold" className="text-amber-300" />
              <span className="font-semibold text-white">{totalDeals}</span>
              <span className="text-white/70 text-sm">Deals</span>
            </div>
            <div className="w-px h-4 bg-white/20" />
            <div className="flex items-center gap-2">
              <Storefront size={18} weight="bold" className="text-amber-300" />
              <span className="font-semibold text-white">
                {categories.length}
              </span>
              <span className="text-white/70 text-sm">Categories</span>
            </div>
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#451a03] mb-8">
            Treatment categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {categories.map((category, index) => (
              <ScrollRevealItem
                key={category.slug}
                index={index}
                animation="fadeInUp"
                stagger={100}
              >
                <CategoryCard category={category} />
              </ScrollRevealItem>
            ))}
          </div>
        </div>
      </section>

      {/* Browse All CTA — surface band */}
      <section className="w-full bg-[#f2ebe2] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h3 className="text-xl font-semibold text-[#451a03] mb-2">
            Looking for something specific?
          </h3>
          <p className="text-[#78350f] mb-6">
            Browse all available deals and filter by location, price, and more.
          </p>
          <Link href="/deals">
            <Button size="lg">
              <Tag size={20} weight="light" />
              Browse all deals
            </Button>
          </Link>
        </div>
      </section>
    </main>
  )
}
