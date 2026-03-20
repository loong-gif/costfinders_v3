import Link from 'next/link'
import { Storefront, ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/button'

export function BusinessCtaSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="bg-stone-900 border border-stone-800 rounded-[16px] p-8 sm:p-12 text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-400/10 border border-amber-400/20 mb-6">
          <Storefront size={28} weight="duotone" className="text-amber-400" />
        </div>

        <h2 className="text-2xl font-bold text-stone-100 mb-3">
          Own a medspa?
        </h2>
        <p className="text-stone-400 mb-8 max-w-md mx-auto">
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
