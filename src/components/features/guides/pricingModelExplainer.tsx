import {
  CurrencyCircleDollar,
  CurrencyDollar,
  Gift,
  Package,
  Repeat,
} from '@phosphor-icons/react/dist/ssr'
import { treatmentDo } from '@/lib/utils/treatment-grammar'
import type { GuideContent } from '@/types/guide'

/**
 * Keyed on the distinguishing WORD, not the full model name.
 *
 * Matching was `name.includes(fullKey)`, which only fired when a guide's model name was a
 * superset of a whole phrase like "Membership Pricing" — so "Membership Plans", "Memberships"
 * and "Per Unit" all fell through to the generic dollar sign. Every guide is written by hand,
 * so the names vary; match the token that actually carries the meaning.
 * Order matters: the first matching token wins.
 */
const modelIcons: Array<[string, React.ReactNode]> = [
  ['membership', <Repeat key="membership" size={20} weight="fill" />],
  ['bundle', <Package key="bundle" size={20} weight="fill" />],
  ['package', <Package key="package" size={20} weight="fill" />],
  ['series', <Package key="series" size={20} weight="fill" />],
  ['complimentary', <Gift key="complimentary" size={20} weight="fill" />],
  ['add-on', <Gift key="add-on" size={20} weight="fill" />],
  ['area', <CurrencyCircleDollar key="area" size={20} weight="fill" />],
  ['flat', <CurrencyCircleDollar key="flat" size={20} weight="fill" />],
  ['session', <CurrencyCircleDollar key="session" size={20} weight="fill" />],
  [
    'treatment',
    <CurrencyCircleDollar key="treatment" size={20} weight="fill" />,
  ],
  ['unit', <CurrencyDollar key="unit" size={20} weight="fill" />],
  ['syringe', <CurrencyDollar key="syringe" size={20} weight="fill" />],
  ['vial', <CurrencyDollar key="vial" size={20} weight="fill" />],
]

function getIcon(name: string) {
  const haystack = name.toLowerCase()
  for (const [token, icon] of modelIcons) {
    if (haystack.includes(token)) return icon
  }
  return <CurrencyDollar size={20} weight="fill" />
}

interface PricingModelExplainerProps {
  content: GuideContent['howPricingWorks']
  treatmentLabel: string
  cityLabel: string
}

export function PricingModelExplainer({
  content,
  treatmentLabel,
  cityLabel,
}: PricingModelExplainerProps) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3">
        How much {treatmentDo(treatmentLabel)} {treatmentLabel.toLowerCase()}{' '}
        cost in {cityLabel}?
      </h2>
      <p className="text-text-secondary mb-6">{content.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {content.pricingModels.map((model) => (
          <div
            key={model.name}
            className="bg-bg-elevated border border-border-default rounded-xl p-5"
          >
            <div className="flex items-center gap-2 text-text-muted mb-2">
              {getIcon(model.name)}
              <h3 className="font-display font-semibold text-text-primary">
                {model.name}
              </h3>
            </div>
            <p className="text-sm text-text-secondary mb-2">
              {model.description}
            </p>
            <p className="text-sm font-medium text-text-primary">
              Typical range: {model.typicalRange}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
