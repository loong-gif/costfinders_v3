import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Image from 'next/image'
import Link from 'next/link'

/**
 * The provider band. The right column is a crop of the real business dashboard's deals list
 * (captured as the test owner account on 2026-09-18, after the dashboard moved to Price
 * Engine) — the deals list, never leads, and cropped below the header so no account name
 * shows. It replaced the anonymous → claimed card pair, which the homepage already shows in
 * "How it works" and /business uses as its pitch. Re-capture it if the deals table changes.
 */
export function BusinessCtaSection() {
  return (
    <section className="w-full bg-bg-inverted py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-on-dark-muted">
              For providers
            </p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-text-on-dark sm:text-4xl">
              Own a medspa?
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-text-on-dark-muted">
              Your promotions may already be listed here. Business accounts are
              not open yet, but you can ask us to add, correct or remove your
              listing.
            </p>

            {/* Link styled as a button, not a <Button> nested inside a <Link> — <button> inside <a>
                is invalid HTML and produced two tab stops for one control. */}
            <Link
              href="/business"
              className="group mt-8 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-full bg-bg-base px-6 text-base font-semibold text-text-primary transition-colors hover:bg-bg-surface"
            >
              List your business
              <ArrowRight
                size={18}
                weight="bold"
                aria-hidden="true"
                className="transition-transform duration-200 group-hover:translate-x-1"
              />
            </Link>
          </div>

          <figure>
            <Image
              src="/images/homepage/business-dashboard.webp"
              alt="The CostFinders business dashboard's deals list: each deal with its category, price, discount and whether it is on the site."
              width={1168}
              height={874}
              sizes="(min-width: 1024px) 560px, 100vw"
              className="w-full rounded-xl border border-white/10 shadow-lg"
            />
            <figcaption className="mt-3 text-sm text-text-on-dark-muted">
              The deals list in a provider&apos;s dashboard.
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  )
}
