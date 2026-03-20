import Link from 'next/link'
import { Storefront, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

export function BusinessCtaSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[16px] p-8 sm:p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-800/8 border border-amber-800/15 mb-6">
          <Storefront size={28} weight="duotone" className="text-amber-800" />
        </div>

        <h2 className="text-2xl font-bold text-[#451a03] mb-3">
          Own a medspa?
        </h2>
        <p className="text-[#78350f] mb-8 max-w-md mx-auto">
          Your promotions are already being discovered by consumers. Claim your
          profile to manage your listings and connect with new clients.
        </p>

        <Link href="/business">
          <Button size="lg">
            List your business
            <ArrowRight size={18} weight="bold" />
          </Button>
        </Link>
      </div>
    </section>
  )
}
