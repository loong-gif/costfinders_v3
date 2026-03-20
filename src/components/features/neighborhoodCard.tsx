import { ArrowRight, MapPin, Storefront, Tag } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface NeighborhoodCardProps {
  name: string
  slug: string
  citySlug: string
  stateSlug: string
  cityName: string
  dealCount: number
  businessCount: number
}

/**
 * NeighborhoodCard - Server Component for displaying neighborhood listings on city pages
 * Features Bold & Warm styling with hover effects and navigation link
 */
export function NeighborhoodCard({
  name,
  slug,
  citySlug,
  stateSlug,
  cityName,
  dealCount,
  businessCount,
}: NeighborhoodCardProps) {
  return (
    <Link
      href={`/${stateSlug}/${citySlug}/${slug}`}
      className="group bg-stone-900 border border-stone-800 rounded-xl p-5 shadow-md transition-all duration-200 hover:border-stone-700 hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-400/10 flex items-center justify-center">
            <MapPin size={20} weight="light" className="text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-stone-100 group-hover:text-amber-400 transition-colors">
              {name}
            </h3>
            <p className="text-sm text-stone-500">{cityName}</p>
          </div>
        </div>
        <ArrowRight
          size={20}
          weight="light"
          className="text-stone-500 group-hover:text-amber-400 group-hover:translate-x-1 transition-all"
        />
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-stone-800 flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-stone-400">
          <Tag size={16} weight="light" className="text-amber-400" />
          <span>{dealCount} deals</span>
        </div>
        <div className="flex items-center gap-1.5 text-stone-400">
          <Storefront size={16} weight="light" className="text-amber-400" />
          <span>{businessCount} providers</span>
        </div>
      </div>
    </Link>
  )
}
