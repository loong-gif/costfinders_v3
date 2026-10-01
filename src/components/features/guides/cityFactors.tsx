import {
  Buildings,
  ChartLineUp,
  CurrencyDollar,
  MapPin,
  Users,
} from '@phosphor-icons/react/dist/ssr'
import type { GuideContent } from '@/types/guide'

const factorIcons = [
  <CurrencyDollar key="cost" size={20} weight="fill" />,
  <Buildings key="comp" size={20} weight="fill" />,
  <Users key="demo" size={20} weight="fill" />,
  <ChartLineUp key="demand" size={20} weight="fill" />,
  <MapPin key="loc" size={20} weight="fill" />,
]

interface CityFactorsProps {
  content: GuideContent['whatAffectsPricing']
  cityLabel: string
  treatmentLabel: string
}

export function CityFactors({
  content,
  cityLabel,
  treatmentLabel,
}: CityFactorsProps) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-3">
        What affects {treatmentLabel.toLowerCase()} cost in {cityLabel}
      </h2>
      <p className="text-text-secondary mb-6">{content.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {content.factors.map((item, i) => (
          <div
            key={item.factor}
            className="flex gap-4 bg-bg-elevated border border-border-default rounded-xl p-5"
          >
            <div className="text-text-muted shrink-0 mt-0.5">
              {factorIcons[i % factorIcons.length]}
            </div>
            <div>
              <h3 className="font-display font-semibold text-text-primary mb-1">
                {item.factor}
              </h3>
              <p className="text-sm text-text-secondary">{item.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
