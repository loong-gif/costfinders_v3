import { Lightbulb, Tag } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
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
      <h2 className="text-2xl font-bold text-[#451a03] mb-3">
        How to save on {treatmentLabel.toLowerCase()} in {cityLabel}
      </h2>
      <p className="text-[#78350f]/80 mb-6">{content.intro}</p>

      <div className="space-y-4 mb-8">
        {content.tips.map((item) => (
          <div key={item.tip} className="flex gap-3">
            <div className="text-amber-800 shrink-0 mt-1">
              <Lightbulb size={18} weight="fill" />
            </div>
            <div>
              <p className="font-semibold text-[#451a03]">{item.tip}</p>
              <p className="text-sm text-[#78350f]/80">{item.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {deals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#78350f]/60 uppercase tracking-wide mb-3">
            Top deals right now
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <div
                key={deal.id}
                className="bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-[#451a03] text-sm line-clamp-2">
                    {deal.title}
                  </p>
                  {deal.originalPrice > 0 &&
                    deal.dealPrice < deal.originalPrice && (
                      <span className="shrink-0 bg-amber-800 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {Math.round(
                          ((deal.originalPrice - deal.dealPrice) /
                            deal.originalPrice) *
                            100,
                        )}
                        % off
                      </span>
                    )}
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-lg font-bold text-amber-800">
                    ${deal.dealPrice}
                  </span>
                  {deal.originalPrice > 0 &&
                    deal.dealPrice < deal.originalPrice && (
                      <span className="text-sm text-[#78350f]/50 line-through">
                        ${deal.originalPrice}
                      </span>
                    )}
                  {deal.unit && (
                    <span className="text-xs text-[#78350f]/60">
                      /{deal.unit}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Link
            href={dealsLink}
            className="inline-flex items-center gap-2 mt-4 text-sm font-medium text-amber-800 hover:text-amber-900 transition-colors"
          >
            <Tag size={16} weight="fill" />
            View all deals →
          </Link>
        </div>
      )}
    </section>
  )
}
