'use client'

import { ArrowRight, Storefront } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ScrollReveal } from '@/components/patterns/scrollReveal'

export function BusinessCtaSection() {
  return (
    <section className="w-full bg-[#451a03] py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal animation="fadeInUp">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center">
            {/* Image — shows first on mobile */}
            <div className="order-1 lg:order-2">
              <div className="relative rounded-2xl overflow-hidden aspect-[4/3]">
                <Image
                  src="/images/homepage/business-cta.webp"
                  alt="Modern medspa storefront at golden hour"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  loading="lazy"
                />
              </div>
            </div>

            {/* Text content */}
            <div className="order-2 lg:order-1">
              <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-800/30 border border-amber-700/40 mb-6">
                <Storefront
                  size={28}
                  weight="duotone"
                  className="text-amber-400"
                />
              </div>

              <h2 className="text-3xl sm:text-4xl font-bold text-[#faf5ee] mb-4">
                Own a medspa?
              </h2>
              <p className="text-[#d4c4b0] text-lg mb-8 max-w-md leading-relaxed">
                Your promotions are already being discovered by consumers. Claim
                your profile to manage your listings and connect with new
                clients.
              </p>

              <Link href="/business">
                <Button
                  size="lg"
                  className="bg-amber-600 hover:bg-amber-500 text-white border-0 shadow-[0_0_24px_rgba(217,119,6,0.3)] hover:shadow-[0_0_32px_rgba(217,119,6,0.5)] transition-all duration-300"
                >
                  List your business
                  <ArrowRight
                    size={18}
                    weight="bold"
                    className="group-hover:translate-x-1 transition-transform"
                  />
                </Button>
              </Link>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
