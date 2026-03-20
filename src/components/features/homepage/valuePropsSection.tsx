'use client'

import {
  MagnifyingGlass,
  PiggyBank,
  Scales,
} from '@phosphor-icons/react'
import Image from 'next/image'
import { useScrollReveal } from '@/lib/hooks/useScrollReveal'

const steps = [
  {
    icon: MagnifyingGlass,
    step: '01',
    title: 'Browse',
    description:
      'Search by treatment or city. See real prices from real providers — no hidden fees.',
  },
  {
    icon: Scales,
    step: '02',
    title: 'Compare',
    description:
      'Side-by-side pricing so you can spot the best value. Filter by category, location, or price.',
  },
  {
    icon: PiggyBank,
    step: '03',
    title: 'Save',
    description:
      'Claim deals directly. Save 20-60% compared to standard pricing at top medspas.',
  },
]

export function ValuePropsSection() {
  const { ref, isVisible } = useScrollReveal({ threshold: 0.2 })

  return (
    <section className="relative w-full overflow-hidden py-20 sm:py-28">
      {/* Background image */}
      <Image
        src="/images/homepage/value-props-bg.png"
        alt=""
        fill
        className="object-cover"
        sizes="100vw"
        loading="lazy"
      />

      {/* Dark warm overlay */}
      <div
        className="absolute inset-0 bg-[#451a03]/80"
        aria-hidden="true"
      />

      <div
        ref={ref}
        className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
      >
        <div className="text-center mb-14">
          <h2
            className={`text-3xl sm:text-4xl font-bold text-white transition-all duration-700 ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            How it works
          </h2>
          <p
            className={`text-white/60 mt-3 text-lg transition-all duration-700 delay-200 ${
              isVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-6'
            }`}
          >
            Three steps to better prices
          </p>
        </div>

        {/* Desktop: Horizontal timeline */}
        <div className="hidden md:block">
          <div className="relative grid grid-cols-3 gap-8">
            {/* Connecting line */}
            <div className="absolute top-7 left-[16.5%] right-[16.5%] h-[2px] bg-white/20">
              <div
                className={`h-full bg-amber-500/60 origin-left transition-transform duration-1000 delay-500 ${
                  isVisible ? 'scale-x-100' : 'scale-x-0'
                }`}
              />
            </div>

            {steps.map((item, index) => (
              <div
                key={item.step}
                className={`text-center transition-all duration-700 ${
                  isVisible
                    ? 'opacity-100 translate-y-0'
                    : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${400 + index * 200}ms` }}
              >
                {/* Step circle with icon */}
                <div className="relative z-10 inline-flex items-center justify-center w-14 h-14 rounded-full bg-amber-700 shadow-[0_0_20px_rgba(146,64,14,0.4)] mb-6">
                  <item.icon size={24} weight="bold" className="text-white" />
                </div>

                <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-2">
                  Step {item.step}
                </div>
                <h3 className="font-bold text-white text-xl mb-3">
                  {item.title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed max-w-[260px] mx-auto">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Mobile: Vertical timeline */}
        <div className="md:hidden space-y-8">
          {steps.map((item, index) => (
            <div
              key={item.step}
              className={`flex gap-5 transition-all duration-700 ${
                isVisible
                  ? 'opacity-100 translate-x-0'
                  : 'opacity-0 -translate-x-6'
              }`}
              style={{ transitionDelay: `${400 + index * 200}ms` }}
            >
              {/* Vertical line + circle */}
              <div className="flex flex-col items-center">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-700 shadow-[0_0_16px_rgba(146,64,14,0.4)] shrink-0">
                  <item.icon size={22} weight="bold" className="text-white" />
                </div>
                {index < steps.length - 1 && (
                  <div className="w-[2px] flex-1 bg-white/20 mt-2" />
                )}
              </div>

              {/* Content */}
              <div className="pb-6">
                <div className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">
                  Step {item.step}
                </div>
                <h3 className="font-bold text-white text-lg mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-white/70 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
