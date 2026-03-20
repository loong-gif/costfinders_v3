'use client'

import {
  CheckCircle,
  CurrencyDollar,
  ShieldCheck,
  Users,
} from '@phosphor-icons/react'
import { AnimatedCounter } from '@/components/patterns/animatedCounter'
import { ScrollReveal } from '@/components/patterns/scrollReveal'

interface SocialProofSectionProps {
  totalOffers: number
  totalBusinesses: number
}

const trustIndicators = [
  {
    icon: ShieldCheck,
    label: 'Verified prices',
  },
  {
    icon: Users,
    label: 'Real providers',
  },
  {
    icon: CurrencyDollar,
    label: 'No hidden fees',
  },
  {
    icon: CheckCircle,
    label: 'Transparent savings',
  },
]

export function SocialProofSection({
  totalOffers,
  totalBusinesses,
}: SocialProofSectionProps) {
  return (
    <section className="w-full bg-[#faf5ee] py-16 sm:py-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fadeInUp">
          {/* Stats row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 text-center mb-12">
            <div>
              <AnimatedCounter
                end={totalOffers}
                suffix="+"
                className="font-mono text-4xl sm:text-5xl font-bold text-amber-800"
              />
              <p className="text-sm text-[#78350f] mt-2 font-medium">
                Active deals
              </p>
            </div>
            <div>
              <AnimatedCounter
                end={totalBusinesses}
                suffix="+"
                className="font-mono text-4xl sm:text-5xl font-bold text-amber-800"
              />
              <p className="text-sm text-[#78350f] mt-2 font-medium">
                Verified providers
              </p>
            </div>
            <div>
              <span className="font-mono text-4xl sm:text-5xl font-bold text-amber-800">
                20-60
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-bold text-amber-800">
                %
              </span>
              <p className="text-sm text-[#78350f] mt-2 font-medium">
                Average savings
              </p>
            </div>
            <div>
              <span className="font-mono text-4xl sm:text-5xl font-bold text-amber-800">
                100
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-bold text-amber-800">
                %
              </span>
              <p className="text-sm text-[#78350f] mt-2 font-medium">
                Price verified
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-full h-px bg-[#d4c4b0] mb-10" />

          {/* Trust indicators */}
          <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
            {trustIndicators.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-2 text-[#78350f]"
              >
                <item.icon
                  size={20}
                  weight="duotone"
                  className="text-amber-800"
                />
                <span className="text-sm font-medium">{item.label}</span>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
