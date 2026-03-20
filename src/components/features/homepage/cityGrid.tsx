import Link from 'next/link'
import { MapPin } from '@phosphor-icons/react/dist/ssr'

interface CityGridProps {
  cities: { city: string; count: number }[]
}

export function CityGrid({ cities }: CityGridProps) {
  return (
    <section className="py-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-stone-100">
          Browse by city
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {cities.map((item) => (
          <Link
            key={item.city}
            href={`/deals?city=${encodeURIComponent(item.city)}`}
            className="group flex items-center gap-3 bg-stone-900 border border-stone-800 rounded-[10px] px-4 py-3 hover:border-stone-700 transition-all duration-200 cursor-pointer"
          >
            <div className="flex items-center justify-center w-8 h-8 rounded-md bg-stone-800 group-hover:bg-amber-400/10 transition-colors shrink-0">
              <MapPin
                size={16}
                weight="bold"
                className="text-stone-400 group-hover:text-amber-400 transition-colors"
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-stone-200 group-hover:text-stone-100 truncate">
                {item.city}
              </p>
              <p className="text-xs text-stone-500">
                {item.count} {item.count === 1 ? 'provider' : 'providers'}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
