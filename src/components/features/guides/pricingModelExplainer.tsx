import {
  CurrencyDollar,
  CurrencyCircleDollar,
  Package,
  Repeat,
  Gift,
} from '@phosphor-icons/react/dist/ssr'
import type { GuideContent } from '@/types/guide'

const modelIcons: Record<string, React.ReactNode> = {
  'Per-Unit Pricing': <CurrencyDollar size={20} weight="fill" />,
  'Per-Syringe Pricing': <CurrencyDollar size={20} weight="fill" />,
  'Per-Vial Pricing': <CurrencyDollar size={20} weight="fill" />,
  'Per-Area Pricing': <CurrencyCircleDollar size={20} weight="fill" />,
  'Flat-Rate Pricing': <CurrencyCircleDollar size={20} weight="fill" />,
  'Bundle Pricing': <Package size={20} weight="fill" />,
  'Bundle Packages': <Package size={20} weight="fill" />,
  'Membership Pricing': <Repeat size={20} weight="fill" />,
  'Membership Programs': <Repeat size={20} weight="fill" />,
  'Complimentary Add-Ons': <Gift size={20} weight="fill" />,
}

function getIcon(name: string) {
  for (const [key, icon] of Object.entries(modelIcons)) {
    if (name.toLowerCase().includes(key.toLowerCase())) return icon
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
      <h2 className="text-2xl font-bold text-[#451a03] mb-3">
        How {treatmentLabel} is priced in {cityLabel}
      </h2>
      <p className="text-[#78350f]/80 mb-6">{content.intro}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {content.pricingModels.map((model) => (
          <div
            key={model.name}
            className="bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-5"
          >
            <div className="flex items-center gap-2 text-amber-800 mb-2">
              {getIcon(model.name)}
              <h3 className="font-semibold text-[#451a03]">{model.name}</h3>
            </div>
            <p className="text-sm text-[#78350f]/80 mb-2">
              {model.description}
            </p>
            <p className="text-sm font-medium text-amber-800">
              Typical range: {model.typicalRange}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
