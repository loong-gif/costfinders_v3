import Link from 'next/link'
import { Syringe, Drop, Sparkle, Heart, Stethoscope, FirstAid } from '@phosphor-icons/react/dist/ssr'
import type { Icon } from '@phosphor-icons/react'

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
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-stone-100">
          Browse by treatment
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {categories.map((cat) => {
          const IconComponent = CATEGORY_ICONS[cat.slug] ?? FirstAid
          return (
            <Link
              key={cat.slug}
              href={`/deals?category=${cat.slug}`}
              className="group bg-stone-900 border border-stone-800 rounded-[10px] p-4 text-center hover:border-amber-400/30 hover:shadow-[0_0_20px_rgba(251,191,36,0.1)] transition-all duration-200 cursor-pointer"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-amber-400/10 group-hover:bg-amber-400/20 transition-colors mb-3">
                <IconComponent
                  size={20}
                  weight="duotone"
                  className="text-amber-400"
                />
              </div>
              <p className="text-sm font-medium text-stone-200 group-hover:text-stone-100 mb-0.5">
                {cat.label}
              </p>
              <p className="text-xs text-stone-500">
                {cat.count} {cat.count === 1 ? 'deal' : 'deals'}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
