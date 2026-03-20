'use client'

import { MapPin } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { ScrollRevealItem } from '@/components/patterns/scrollReveal'

interface CityGridProps {
  cities: { city: string; slug: string; dealCount: number; providerCount: number }[]
}

const CITY_IMAGES = [
  '/images/homepage/city-1.png',
  '/images/homepage/city-2.png',
  '/images/homepage/city-3.png',
  '/images/homepage/city-4.png',
]

export function CityGrid({ cities }: CityGridProps) {
  const visibleCities = cities.filter((c) => c.dealCount > 0)

  if (visibleCities.length === 0) return null

  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-[#451a03]">
              Browse by city
            </h2>
            <p className="text-sm text-[#78350f] mt-1">
              Discover providers near you
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {visibleCities.map((item, index) => (
            <ScrollRevealItem
              key={item.city}
              index={index}
              animation="fadeInUp"
              stagger={100}
            >
              <Link
                href={`/deals/${item.slug}`}
                className="group relative block h-40 sm:h-44 rounded-xl overflow-hidden cursor-pointer"
              >
                {/* City background image */}
                <Image
                  src={CITY_IMAGES[index % CITY_IMAGES.length]}
                  alt={`${item.city} skyline`}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-500"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                  loading="lazy"
                />

                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[#451a03]/80 via-[#451a03]/30 to-transparent group-hover:from-[#451a03]/70 transition-colors duration-300" />

                {/* Content overlay */}
                <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 z-10">
                  <div className="flex items-center gap-2 mb-1">
                    <MapPin
                      size={16}
                      weight="fill"
                      className="text-amber-300"
                    />
                    <h3 className="text-white font-semibold text-lg">
                      {item.city}
                    </h3>
                  </div>
                  <p className="text-white/70 text-sm">
                    {item.dealCount} {item.dealCount === 1 ? 'deal' : 'deals'}
                  </p>
                </div>
              </Link>
            </ScrollRevealItem>
          ))}
        </div>
      </div>
    </section>
  )
}
