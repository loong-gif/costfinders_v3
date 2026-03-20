import Link from 'next/link'
import { MapPin } from '@phosphor-icons/react/dist/ssr'

interface CityGridProps {
  cities: { city: string; count: number }[]
}

export function CityGrid({ cities }: CityGridProps) {
  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-[#451a03]">
          Browse by city
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cities.map((item) => (
          <Link
            key={item.city}
            href={`/deals?city=${encodeURIComponent(item.city)}`}
            className="group flex items-center gap-3 bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] px-4 py-3 hover:border-[#c4b09a] transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#faf5ee] group-hover:bg-amber-800/8 transition-colors shrink-0">
              <MapPin
                size={16}
                weight="bold"
                className="text-[#78350f] group-hover:text-amber-800 transition-colors"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#5c2d0a] group-hover:text-[#451a03] truncate">
                {item.city}
              </p>
              <p className="text-xs text-[#92400e]">
                {item.count} {item.count === 1 ? 'provider' : 'providers'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
