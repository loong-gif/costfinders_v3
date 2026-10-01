import { ArrowDown } from '@phosphor-icons/react/dist/ssr'
import type { FinePrintFacts } from '@/lib/data/homepage'

interface PriceBasisDiagramProps {
  facts: FinePrintFacts
}

/**
 * How we make prices comparable, illustrated. The three input cards are the three shapes
 * `offerPriceBasis()` reads a price into — `rate`, `quantity`, `total` (src/lib/data/adapters.ts,
 * `PriceBasis` in src/types/deal.ts) — and the branch below the node is `comparablePrice()`'s
 * rule: neurotoxins compare per unit, everything else compares on what you pay (owner decision
 * 2026-09-18, CLAUDE.md "price basis"). The $10/$299/$450 worked example is illustrative, not
 * live data; the fact row underneath is counted from `facts`.
 */
export function PriceBasisDiagram({ facts }: PriceBasisDiagramProps) {
  return (
    <section className="w-full bg-bg-surface py-14 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <h2 className="text-center font-display text-2xl font-bold tracking-tight text-text-primary sm:text-3xl">
          How we make prices comparable
        </h2>
        <p className="mt-2 text-center text-text-secondary">
          Providers advertise three shapes of price. We read which one it is
          before we compare anything.
        </p>

        {/* Desktop: 7-column grid with SVG connectors. Below lg: stacked cards. */}
        <div className="mt-12 hidden lg:grid lg:grid-cols-[1fr_2.5rem_auto_2.5rem_1.2fr_2.5rem_1fr] lg:items-center lg:gap-0">
          {/* Inputs */}
          <div className="flex flex-col gap-3">
            <InputCard figure="$10" unit="per unit" label="a rate" />
            <InputCard figure="$299" unit="for 40 units" label="a quantity" />
            <InputCard figure="$450" unit="lip filler" label="a flat total" />
          </div>

          <Connector1 />

          {/* Node */}
          <div className="relative mx-auto flex h-32 w-32 items-center justify-center rounded-full bg-text-primary p-4 text-center text-sm font-semibold text-white">
            <span className="absolute top-4 h-2.5 w-2.5 rounded-full bg-accent-graphic" />
            Read what the price buys
          </div>

          <Connector2 />

          {/* Outputs */}
          <div className="flex flex-col justify-center gap-3">
            <div className="h-36 rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
              <p className="border-b border-border-default pb-2 text-sm font-semibold text-text-primary">
                Neurotoxins → compared per unit
              </p>
              <p className="mt-2 font-display text-xl font-bold tabular-nums text-text-primary">
                $299 ÷ 40 ={' '}
                <span className="whitespace-nowrap text-accent">
                  $7.48 per unit
                </span>
              </p>
            </div>
            <div className="h-36 rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
              <p className="text-sm font-semibold text-text-primary">
                Everything else → compared on what you pay
              </p>
              <p className="mt-2 font-display text-xl font-bold tabular-nums text-text-primary">
                $450
              </p>
            </div>
          </div>

          <Connector3 />

          {/* Result */}
          <div className="rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
            <p className="text-sm font-medium text-text-secondary">
              What you see
            </p>
            <div className="mt-2 rounded-lg border border-border-default p-3">
              <span className="inline-block rounded-full bg-savings-bg px-2 py-0.5 text-xs font-semibold text-savings">
                Save 25%
              </span>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-text-primary">
                $7.48
              </p>
              <p className="text-sm text-text-muted">per unit</p>
            </div>
          </div>
        </div>

        {/* Mobile / tablet: stacked reading order. The worked result is one unbreakable run in
            both layouts: at 320px it read "$7.48 per" / "unit" (2026-09-28). */}
        <div className="mt-10 flex flex-col items-center gap-3 lg:hidden">
          <InputCard figure="$10" unit="per unit" label="a rate" full />
          <InputCard
            figure="$299"
            unit="for 40 units"
            label="a quantity"
            full
          />
          <InputCard
            figure="$450"
            unit="lip filler"
            label="a flat total"
            full
          />
          <ArrowDown size={20} weight="light" className="text-text-muted" />
          <div className="relative flex h-28 w-28 items-center justify-center rounded-full bg-text-primary p-4 text-center text-sm font-semibold text-white">
            <span className="absolute top-4 h-2.5 w-2.5 rounded-full bg-accent-graphic" />
            Read what the price buys
          </div>
          <ArrowDown size={20} weight="light" className="text-text-muted" />
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
            <p className="border-b border-border-default pb-2 text-sm font-semibold text-text-primary">
              Neurotoxins → compared per unit
            </p>
            <p className="mt-2 font-display text-xl font-bold tabular-nums text-text-primary">
              $299 ÷ 40 ={' '}
              <span className="whitespace-nowrap text-accent">
                $7.48 per unit
              </span>
            </p>
          </div>
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
            <p className="text-sm font-semibold text-text-primary">
              Everything else → compared on what you pay
            </p>
            <p className="mt-2 font-display text-xl font-bold tabular-nums text-text-primary">
              $450
            </p>
          </div>
          <ArrowDown size={20} weight="light" className="text-text-muted" />
          <div className="w-full max-w-sm rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm">
            <p className="text-sm font-medium text-text-secondary">
              What you see
            </p>
            <div className="mt-2 rounded-lg border border-border-default p-3">
              <span className="inline-block rounded-full bg-savings-bg px-2 py-0.5 text-xs font-semibold text-savings">
                Save 25%
              </span>
              <p className="mt-2 font-display text-2xl font-bold tabular-nums text-text-primary">
                $7.48
              </p>
              <p className="text-sm text-text-muted">per unit</p>
            </div>
          </div>
        </div>

        {facts.total > 0 && (
          <div className="mt-12 grid gap-6 border-t border-border-default pt-8 text-text-secondary sm:grid-cols-3">
            <p>
              <span className="font-display text-2xl font-bold tabular-nums text-accent">
                {Math.round((facts.membershipRequired / facts.total) * 100)}%
              </span>{' '}
              of advertised deals require a membership
            </p>
            <p>
              <span className="font-display text-2xl font-bold tabular-nums text-accent">
                {Math.round((facts.newCustomerOnly / facts.total) * 100)}%
              </span>{' '}
              are for new customers only
            </p>
            <p>
              <span className="font-display text-2xl font-bold tabular-nums text-accent">
                {facts.statesBeforePrice.toLocaleString('en-US')}
              </span>{' '}
              state a price before the discount
            </p>
          </div>
        )}
        <p className="mt-4 text-xs text-text-muted">
          Counted across the {facts.total.toLocaleString('en-US')} deals
          currently listed.
        </p>
      </div>
    </section>
  )
}

function InputCard({
  figure,
  unit,
  label,
  full,
}: {
  figure: string
  unit: string
  label: string
  full?: boolean
}) {
  return (
    <div
      className={`flex h-24 flex-col justify-between rounded-xl border border-border-default bg-bg-elevated p-4 shadow-sm ${full ? 'w-full max-w-sm' : ''}`}
    >
      <div>
        <span className="font-display text-2xl font-bold tabular-nums text-text-primary">
          {figure}
        </span>{' '}
        <span className="text-text-secondary">{unit}</span>
      </div>
      <span className="text-xs text-text-muted">{label}</span>
    </div>
  )
}

/** Three inputs (96px cards, 12px gaps → centers at y=48, 156, 264 of 312) converging on the node. */
function Connector1() {
  return (
    <svg
      viewBox="0 0 40 312"
      className="hidden h-[312px] w-10 lg:block"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="pbd-arrow-1"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" />
        </marker>
      </defs>
      {[48, 156, 264].map((y) => (
        <path
          key={y}
          d={`M0,${y} C20,${y} 20,156 34,156`}
          stroke="var(--color-text-primary)"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#pbd-arrow-1)"
        />
      ))}
    </svg>
  )
}

/** Node center (y=156) fanning out to the two output cards (centers at y=80, 232 of 312). */
function Connector2() {
  return (
    <svg
      viewBox="0 0 40 312"
      className="hidden h-[312px] w-10 lg:block"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="pbd-arrow-2"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" />
        </marker>
      </defs>
      {[80, 232].map((y) => (
        <path
          key={y}
          d={`M0,156 C20,156 20,${y} 34,${y}`}
          stroke="var(--color-text-primary)"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#pbd-arrow-2)"
        />
      ))}
    </svg>
  )
}

/** The two output cards (centers y=80, 232) merging into the result card at y=156. */
function Connector3() {
  return (
    <svg
      viewBox="0 0 40 312"
      className="hidden h-[312px] w-10 lg:block"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="pbd-arrow-3"
          markerWidth="6"
          markerHeight="6"
          refX="5"
          refY="3"
          orient="auto"
        >
          <path d="M0,0 L6,3 L0,6 Z" fill="var(--color-text-primary)" />
        </marker>
      </defs>
      {[80, 232].map((y) => (
        <path
          key={y}
          d={`M0,${y} C20,${y} 20,156 34,156`}
          stroke="var(--color-text-primary)"
          strokeWidth="1.5"
          fill="none"
          markerEnd="url(#pbd-arrow-3)"
        />
      ))}
    </svg>
  )
}
