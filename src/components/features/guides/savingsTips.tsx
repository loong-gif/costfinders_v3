import { Lightbulb, Tag } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { OfferRow } from '@/components/features/offerRow'
import { dealToLean } from '@/lib/data/adapters'
import type { AnonymousDeal } from '@/types/deal'
import type { GuideContent } from '@/types/guide'

interface SavingsTipsProps {
  content: GuideContent['howToSave']
  treatmentLabel: string
  cityLabel: string
  deals: AnonymousDeal[]
  dealsLink: string
}

export function SavingsTips({
  content,
  treatmentLabel,
  cityLabel,
  deals,
  dealsLink,
}: SavingsTipsProps) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3">
        How to save on {treatmentLabel.toLowerCase()} in {cityLabel}
      </h2>
      <p className="text-text-secondary mb-6">{content.intro}</p>

      <div className="space-y-4 mb-8">
        {content.tips.map((item) => (
          <div key={item.tip} className="flex gap-3">
            <div className="text-text-muted shrink-0 mt-1">
              <Lightbulb size={18} weight="fill" />
            </div>
            <div>
              <p className="font-semibold text-text-primary">{item.tip}</p>
              <p className="text-sm text-text-secondary">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {deals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
            {/* Named for what getGuideDealsPreview ranks by — savings % — not "top". */}
            Biggest advertised discounts
          </h3>
          {/* The shared row card, linked to each deal. These were bespoke tiles with no link:
              a "top deal" you could not open. */}
          <ul className="space-y-3">
            {deals.map((deal) => (
              <li key={deal.id}>
                <OfferRow offer={dealToLean(deal)} href={`/deals/${deal.id}`} />
              </li>
            ))}
          </ul>
          <Link
            href={dealsLink}
            className="inline-flex min-h-[44px] items-center gap-2 mt-2 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
          >
            <Tag size={16} weight="fill" />
            View all deals →
          </Link>
        </div>
      )}
    </section>
  )
}
