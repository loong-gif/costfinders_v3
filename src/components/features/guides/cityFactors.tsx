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
}

export function CityFactors({ content, cityLabel }: CityFactorsProps) {
  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-[#451a03] mb-3">
        What affects pricing in {cityLabel}
      </h2>
      <p className="text-[#78350f]/80 mb-6">{content.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {content.factors.map((item, i) => (
          <div
            key={item.factor}
            className="flex gap-4 bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-5"
          >
            <div className="text-amber-800 shrink-0 mt-0.5">
              {factorIcons[i % factorIcons.length]}
            </div>
            <div>
              <h3 className="font-semibold text-[#451a03] mb-1">
                {item.factor}
              </h3>
              <p className="text-sm text-[#78350f]/80">{item.explanation}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
