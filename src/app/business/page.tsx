'use client'

import {
  ArrowRight,
  CheckCircle,
  ChartLineUp,
  MagnifyingGlass,
  Plus,
  ShieldCheck,
  Storefront,
  Tag,
  Users,
} from '@phosphor-icons/react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { BusinessSearchModal } from '@/components/features/businessSearchModal'
import { AnimatedCounter } from '@/components/patterns/animatedCounter'
import { ScrollReveal, ScrollRevealItem } from '@/components/patterns/scrollReveal'
import { Button } from '@/components/ui/button'
import type { BusinessSearchResult } from '@/lib/actions/business-data'

const valueProps = [
  {
    icon: ShieldCheck,
    title: 'Claim your profile',
    description:
      'Verify ownership and take control of your business listing. Show customers you are a trusted provider.',
  },
  {
    icon: Tag,
    title: 'Manage your deals',
    description:
      'Create and promote special offers to attract new customers. Set your own pricing and packages.',
  },
  {
    icon: Users,
    title: 'Connect with customers',
    description:
      'Receive qualified leads directly. Grow your medspa business with ready-to-book clients.',
  },
]

export default function BusinessPage() {
  const router = useRouter()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const handleSelectBusiness = (business: BusinessSearchResult) => {
    router.push(`/business/claim/${business.business_id}`)
  }

  const handleCreateNew = () => {
    router.push('/business/create')
  }

  return (
    <main className="min-h-screen pt-16 pb-0">
      {/* Hero — full-bleed with image background */}
      <section className="relative w-full min-h-[60vh] sm:min-h-[70vh] flex items-center overflow-hidden">
        <Image
          src="/images/business-owner.png"
          alt=""
          fill
          className="object-cover"
          sizes="100vw"
          priority
        />
        <div
          className="absolute inset-0 bg-gradient-to-b from-[#451a03]/70 via-[#451a03]/50 to-[#e8ddd0]"
          aria-hidden="true"
        />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-16 sm:py-24">
          <div className="max-w-2xl">
            <div
              className={`inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 rounded-full px-4 py-1.5 mb-6 transition-all duration-700 ${
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-4'
              }`}
            >
              <Storefront size={16} weight="fill" className="text-amber-300" />
              <span className="text-sm text-white/90 font-medium">
                For medspa owners
              </span>
            </div>

            <h1
              className={`text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 leading-tight transition-all duration-700 delay-200 ${
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-6'
              }`}
            >
              Grow your <span className="text-amber-300">medspa</span> business
            </h1>
            <p
              className={`text-lg text-white/80 mb-10 max-w-xl transition-all duration-700 delay-400 ${
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-6'
              }`}
            >
              Join CostFinders to showcase your practice, manage deals, and
              connect with customers looking for your services.
            </p>

            <div
              className={`flex flex-col sm:flex-row gap-4 transition-all duration-700 delay-500 ${
                mounted
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-6'
              }`}
            >
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsSearchModalOpen(true)}
                className="shadow-[0_0_30px_rgba(146,64,14,0.4)] hover:shadow-[0_0_40px_rgba(146,64,14,0.6)]"
              >
                <MagnifyingGlass size={20} weight="bold" />
                Find my business
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleCreateNew}
                className="bg-white/15 backdrop-blur-sm border-white/20 text-white hover:bg-white/25 hover:text-white"
              >
                <Plus size={20} weight="bold" />
                List a new business
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Value Propositions */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#451a03] mb-3">
              Why join CostFinders?
            </h2>
            <p className="text-[#78350f] max-w-xl mx-auto">
              Everything you need to attract new clients and grow your practice
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {valueProps.map((prop, index) => (
              <ScrollRevealItem
                key={prop.title}
                index={index}
                animation="fadeInUp"
                stagger={120}
              >
                <div className="group relative p-6 rounded-2xl border border-[#d4c4b0] bg-[#f2ebe2] hover:border-[#c4b09a] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(69,26,3,0.12)] transition-all duration-300 overflow-hidden">
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-amber-800 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300" />

                  <div className="w-12 h-12 rounded-xl bg-amber-800/8 group-hover:bg-amber-800/15 flex items-center justify-center transition-colors duration-300 mb-4">
                    <prop.icon
                      size={24}
                      weight="duotone"
                      className="text-amber-800"
                    />
                  </div>
                  <h3 className="font-semibold text-lg text-[#451a03] mb-2">
                    {prop.title}
                  </h3>
                  <p className="text-sm text-[#78350f] leading-relaxed">
                    {prop.description}
                  </p>
                </div>
              </ScrollRevealItem>
            ))}
          </div>
        </div>
      </section>

      {/* Stats — elevated band */}
      <section className="w-full bg-[#faf5ee] py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ScrollReveal animation="fadeInUp">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
              <div>
                <AnimatedCounter
                  end={354}
                  suffix="+"
                  className="font-mono text-3xl sm:text-4xl font-bold text-amber-800"
                />
                <p className="text-sm text-[#78350f] mt-1">Providers listed</p>
              </div>
              <div>
                <AnimatedCounter
                  end={280}
                  suffix="+"
                  className="font-mono text-3xl sm:text-4xl font-bold text-amber-800"
                />
                <p className="text-sm text-[#78350f] mt-1">Active deals</p>
              </div>
              <div>
                <span className="font-mono text-3xl sm:text-4xl font-bold text-amber-800">
                  Free
                </span>
                <p className="text-sm text-[#78350f] mt-1">To get started</p>
              </div>
              <div>
                <AnimatedCounter
                  end={20}
                  suffix="+"
                  className="font-mono text-3xl sm:text-4xl font-bold text-amber-800"
                />
                <p className="text-sm text-[#78350f] mt-1">Cities covered</p>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* Bottom CTA — dark inverted */}
      <section className="w-full bg-[#451a03] py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <ScrollReveal animation="fadeInUp">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#faf5ee] mb-4">
              Ready to get started?
            </h2>
            <p className="text-[#d4c4b0] mb-8 max-w-lg mx-auto">
              Claim your business profile in under 2 minutes. No credit card
              required.
            </p>
            <Button
              size="lg"
              onClick={() => setIsSearchModalOpen(true)}
              className="bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-[0_0_24px_rgba(217,119,6,0.3)] hover:shadow-[0_0_32px_rgba(217,119,6,0.5)]"
            >
              <MagnifyingGlass size={20} weight="bold" />
              Find my business
              <ArrowRight size={18} weight="bold" />
            </Button>
          </ScrollReveal>
        </div>
      </section>

      <BusinessSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelect={handleSelectBusiness}
        onCreateNew={handleCreateNew}
      />
    </main>
  )
}
