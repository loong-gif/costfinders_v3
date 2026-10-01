import type { LeanOffer } from '@/types/deal'
import { AnonymousCard, MiniSearch, RevealedCard } from './claimRevealCards'

/**
 * A slim three-step strip. The photo-and-overlay band it replaced carried the same copy
 * under a brown wash; the steps read better as text on white. Step 01 used to promise
 * "Search by treatment or city" when nothing on the site could — the hero search made it true.
 */
export function ValuePropsSection({ examples }: { examples: LeanOffer[] }) {
  const hasExamples = examples.length > 0

  const steps = [
    {
      step: '01',
      title: 'Search',
      description:
        'Pick a treatment and a city. See the prices providers advertise themselves.',
      visual: <MiniSearch />,
    },
    {
      step: '02',
      title: 'Compare',
      description:
        'See prices side by side. Filter by category, location, or price.',
      visual: hasExamples ? (
        <div className="space-y-3">
          {examples.slice(0, 2).map((offer) => (
            <AnonymousCard key={offer.id} offer={offer} />
          ))}
        </div>
      ) : null,
    },
    {
      // "Save 20-60% compared to standard pricing at top medspas" was three unsupported claims
      // in one line: the range (median advertised discount is 18.2% across 314 of 670 visible
      // offers), the comparison baseline (only 118 offers state a price before discount), and
      // "top medspas" (nothing ranks or vets them). Say what the step does instead.
      step: '03',
      title: 'Claim',
      description:
        'Claim a deal to see which provider is offering it and how to reach them. We pass your name and contact details on to that provider.',
      visual: hasExamples ? <RevealedCard offer={examples[0]} /> : null,
    },
  ]

  return (
    <section className="w-full bg-bg-base py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          How it works
        </h2>
        {/* grid-cols-1 is minmax(0,1fr): the implicit auto track grew to the Compare card's
            one-line subtitle (377px) and scrolled the page sideways at 390px. */}
        <ol className="relative mt-10 grid grid-cols-1 gap-10 lg:grid-cols-3 lg:gap-8">
          {/* Dotted connector between the numerals — the ring-bg-base ring on each numeral
              (below) paints over it, so the line reads as passing behind the circles. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-5 hidden border-t border-dotted border-text-primary lg:block"
          />
          {steps.map((item) => (
            <li key={item.step} className="relative">
              <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent font-display font-bold text-sm text-white ring-4 ring-bg-base">
                {item.step}
              </span>
              <h3 className="mt-4 font-display text-xl font-semibold text-text-primary">
                {item.title}
              </h3>
              <p className="mt-2 text-text-secondary leading-relaxed">
                {item.description}
              </p>
              {item.visual && <div className="mt-6">{item.visual}</div>}
            </li>
          ))}
        </ol>
        <p className="mt-10 text-sm text-text-muted">
          Free to use. We list prices providers advertise publicly; we don't
          verify them or book for you.
        </p>
      </div>
    </section>
  )
}
