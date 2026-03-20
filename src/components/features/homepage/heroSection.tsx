'use client'

import { MagnifyingGlass, TrendUp } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface HeroSectionProps {
  categories: { slug: string; label: string; count: number }[]
  totalOffers: number
  totalBusinesses: number
}

export function HeroSection({
  categories,
  totalOffers,
  totalBusinesses,
}: HeroSectionProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  return (
    <section className="relative w-full min-h-[70vh] sm:min-h-[80vh] flex items-center overflow-hidden">
      {/* Background image */}
      <Image
        src="/images/homepage/hero-bg.png"
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        priority
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 bg-gradient-to-b from-[#451a03]/75 via-[#451a03]/50 to-[#e8ddd0]"
        aria-hidden="true"
      />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20 sm:py-28">
        <div className="max-w-3xl mx-auto text-center">
          {/* Stats badge — frosted glass */}
          <div
            className={`inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6 transition-all duration-700 ${
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            }`}
          >
            <TrendUp size={16} weight="bold" className="text-amber-300" />
            <span className="text-sm text-white/90 font-medium">
              {totalOffers} deals from {totalBusinesses} providers
            </span>
          </div>

          {/* Headline */}
          <h1
            className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight transition-all duration-700 delay-200 ${
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            Don&apos;t overpay for{' '}
            <span className="text-amber-300">medspa treatments</span>
          </h1>

          {/* Subtitle */}
          <p
            className={`text-lg text-white/80 mb-10 max-w-xl mx-auto transition-all duration-700 delay-400 ${
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            Compare real prices from verified providers. Find the best deals on
            Botox, fillers, facials, and more.
          </p>

          {/* CTA Button */}
          <div
            className={`transition-all duration-700 delay-500 ${
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            <Link href="/deals">
              <Button
                size="lg"
                className="text-base px-8 py-3.5 shadow-[0_0_30px_rgba(146,64,14,0.4)] hover:shadow-[0_0_40px_rgba(146,64,14,0.6)] transition-shadow duration-300"
              >
                <MagnifyingGlass size={20} weight="bold" />
                Find deals near you
              </Button>
            </Link>
          </div>

          {/* Category chips — frosted glass */}
          <div
            className={`flex flex-wrap items-center justify-center gap-2 mt-10 transition-all duration-700 delay-700 ${
              mounted
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            {categories
              .filter((cat) => cat.count >= 2)
              .map((cat) => (
                <Link
                  key={cat.slug}
                  href={`/treatments/${cat.slug}`}
                  className="bg-white/10 backdrop-blur-sm border border-white/15 text-white/90 hover:bg-white/20 hover:text-white hover:border-white/30 hover:-translate-y-0.5 rounded-full px-4 py-1.5 text-sm transition-all duration-200 cursor-pointer"
                >
                  {cat.label}
                  <span className="ml-1.5 text-amber-300/80">{cat.count}</span>
                </Link>
              ))}
          </div>
        </div>
      </div>
    </section>
  )
}
