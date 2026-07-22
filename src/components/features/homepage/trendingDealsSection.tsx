'use client'

import { ArrowRight, Fire } from '@phosphor-icons/react'
import Link from 'next/link'
import { OfferCard } from '@/components/features/offerCard'
import { ScrollRevealItem } from '@/components/patterns/scrollReveal'
import type { OfferWithBusiness } from '@/types/supabase'

interface TrendingDealsSectionProps {
  offers: OfferWithBusiness[]
}

export function TrendingDealsSection({ offers }: TrendingDealsSectionProps) {
  return (
    <section id="trending-deals" className="scroll-mt-20 py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Fire size={22} weight="fill" className="text-amber-800" />
              <h2 className="text-2xl font-bold text-[#451a03]">
                Trending deals
              </h2>
            </div>
            <p className="text-sm text-[#78350f]">Best savings right now</p>
          </div>

          <Link
            href="/deals"
            className="group hidden sm:flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-700 transition-colors"
          >
            View all deals
            <ArrowRight
              size={16}
              weight="bold"
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {offers.map((offer, index) => (
            <ScrollRevealItem
              key={offer.id}
              index={index}
              animation="fadeInUp"
              stagger={100}
            >
              <Link href={`/deals/${offer.id}`} className="block">
                <OfferCard offer={offer} />
              </Link>
            </ScrollRevealItem>
          ))}
        </div>

        {/* Mobile "View all" link */}
        <div className="mt-6 text-center sm:hidden">
          <Link
            href="/deals"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-amber-800 hover:text-amber-700 transition-colors"
          >
            View all deals
            <ArrowRight
              size={16}
              weight="bold"
              className="group-hover:translate-x-1 transition-transform duration-200"
            />
          </Link>
        </div>
      </div>
    </section>
  )
}
