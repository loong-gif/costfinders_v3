import type { Icon } from '@phosphor-icons/react'
import {
  Drop,
  FirstAid,
  Heart,
  Sparkle,
  Stethoscope,
  Syringe,
} from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

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
  const visibleCategories = categories.filter((cat) => cat.count > 0)

  if (visibleCategories.length === 0) return null

  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#451a03]">
          Browse by treatment
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {visibleCategories.map((cat) => {
          const IconComponent = CATEGORY_ICONS[cat.slug] ?? FirstAid
          return (
            <Link
              key={cat.slug}
              href={`/treatments/${cat.slug}`}
              className="group bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-4 text-center hover:border-amber-800/25 hover:shadow-[0_0_20px_rgba(251,191,36,0.1)] transition-all duration-200 cursor-pointer"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-800/8 group-hover:bg-amber-800/15 transition-colors mb-3">
                <IconComponent
                  size={20}
                  weight="duotone"
                  className="text-amber-800"
                />
              </div>
              <p className="text-sm font-medium text-[#5c2d0a] group-hover:text-[#451a03] mb-0.5">
                {cat.label}
              </p>
              <p className="text-xs text-[#92400e]">
                {cat.count} {cat.count === 1 ? 'deal' : 'deals'}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
