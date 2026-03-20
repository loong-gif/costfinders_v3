import { ArrowRight, MapPin, Storefront, Tag } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

interface CityCardProps {
  name: string
  slug: string
  stateSlug: string
  stateName: string
  dealCount: number
  businessCount: number
}

/**
 * CityCard - Server Component for displaying city listings on state pages
 * Features Bold & Warm styling with hover effects and navigation link
 */
export function CityCard({
  name,
  slug,
  stateSlug,
  stateName,
  dealCount,
  businessCount,
}: CityCardProps) {
  return (
    <Link
      href={`/${stateSlug}/${slug}`}
      className="group bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl p-5 shadow-md transition-all duration-200 hover:border-[#c4b09a] hover:shadow-lg"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-800/8 flex items-center justify-center">
            <MapPin size={20} weight="light" className="text-amber-800" />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-[#451a03] group-hover:text-amber-800 transition-colors">
              {name}
            </h3>
            <p className="text-sm text-[#92400e]">{stateName}</p>
          </div>
        </div>
        <ArrowRight
          size={20}
          weight="light"
          className="text-[#92400e] group-hover:text-amber-800 group-hover:translate-x-1 transition-all"
        />
      </div>

      {/* Stats */}
      <div className="mt-4 pt-4 border-t border-[#d4c4b0] flex items-center gap-4 text-sm">
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Tag size={16} weight="light" className="text-amber-800" />
          <span>{dealCount} deals</span>
        </div>
        <div className="flex items-center gap-1.5 text-[#78350f]">
          <Storefront size={16} weight="light" className="text-amber-800" />
          <span>{businessCount} providers</span>
        </div>
      </div>
    </Link>
  )
}
