'use client'

import type { Icon } from '@phosphor-icons/react'
import {
  Drop,
  FirstAid,
  Heart,
  Sparkle,
  Stethoscope,
  Syringe,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { ScrollRevealItem } from '@/components/patterns/scrollReveal'

interface CategoryGridProps {
  categories: { slug: string; label: string; count: number }[]
}

const CATEGORY_ICONS: Record<string, Icon> = {
  neurotoxins: Syringe,
  fillers: Drop,
  'facials-lasers': Sparkle,
  wellness: Heart,
  consultations: Stethoscope,
  other: FirstAid,
}

export function CategoryGrid({ categories }: CategoryGridProps) {
  return (
    <section className="w-full bg-[#f2ebe2] py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#451a03]">
              Browse by treatment
            </h2>
            <p className="text-sm text-[#78350f] mt-1">
              Find the perfect procedure for you
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {categories.filter((c) => c.count >= 2).map((cat, index) => {
            const IconComponent = CATEGORY_ICONS[cat.slug] ?? FirstAid
            return (
              <ScrollRevealItem
                key={cat.slug}
                index={index}
                animation="scaleIn"
                stagger={80}
              >
                <Link
                  href={`/treatments/${cat.slug}`}
                  className="group block bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-5 text-center hover:border-amber-800/30 hover:shadow-[0_0_24px_rgba(146,64,14,0.1)] transition-all duration-300 cursor-pointer relative overflow-hidden"
                >
                  {/* Bottom accent border — appears on hover */}
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-800 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-800/8 group-hover:bg-amber-800/15 transition-all duration-300 mb-3">
                    <IconComponent
                      size={24}
                      weight="duotone"
                      className="text-amber-800 group-hover:scale-110 group-hover:rotate-6 transition-transform duration-300"
                    />
                  </div>
                  <p className="text-sm font-semibold text-[#451a03] group-hover:text-amber-800 transition-colors duration-300 mb-0.5">
                    {cat.label}
                  </p>
                  <p className="text-xs text-[#92400e]">
                    {cat.count} {cat.count === 1 ? 'deal' : 'deals'}
                  </p>
                </Link>
              </ScrollRevealItem>
            )
          })}
        </div>
      </div>
    </section>
  )
}
