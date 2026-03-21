import {
  CurrencyDollar,
  Storefront,
  Tag,
  TrendDown,
  TrendUp,
} from '@phosphor-icons/react/dist/ssr'
import type { GuidePricingStats } from '@/types/guide'

interface PricingStatsHeroProps {
  treatmentLabel: string
  cityLabel: string
  stateCode: string
  stats: GuidePricingStats
  generatedAt: string
}

export function PricingStatsHero({
  treatmentLabel,
  cityLabel,
  stateCode,
  stats,
  generatedAt,
}: PricingStatsHeroProps) {
  return (
    <section className="mb-10">
      <h1 className="text-3xl sm:text-4xl font-bold text-[#451a03] mb-3">
        {treatmentLabel} Pricing in {cityLabel}, {stateCode}
      </h1>
      <p className="text-[#78350f]/80 text-lg mb-6">
        A comprehensive guide to {treatmentLabel.toLowerCase()} costs, pricing
        models, and how to find the best deals from verified providers in{' '}
        {cityLabel}.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.minPrice != null && (
          <StatCard
            icon={<TrendDown size={20} weight="fill" />}
            label="Starting at"
            value={`$${stats.minPrice}`}
          />
        )}
        {stats.avgPrice != null && (
          <StatCard
            icon={<CurrencyDollar size={20} weight="fill" />}
            label="Average"
            value={`$${stats.avgPrice}`}
          />
        )}
        <StatCard
          icon={<Tag size={20} weight="fill" />}
          label="Active deals"
          value={String(stats.dealCount)}
        />
        <StatCard
          icon={<Storefront size={20} weight="fill" />}
          label="Providers"
          value={String(stats.providerCount)}
        />
      </div>

      {stats.maxPrice != null && stats.minPrice != null && (
        <div className="mt-4 flex items-center gap-2 text-sm text-[#78350f]/70">
          <TrendUp size={16} weight="bold" />
          <span>
            Price range: ${stats.minPrice} – ${stats.maxPrice}
            {stats.medianPrice != null && ` (median $${stats.medianPrice})`}
          </span>
        </div>
      )}

      <p className="mt-2 text-xs text-[#78350f]/50">
        Based on verified provider pricing · Last updated{' '}
        {new Date(generatedAt).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        })}
      </p>
    </section>
  )
}

function StatCard({
  icon,
  label,
  value,
}: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-4">
      <div className="flex items-center gap-2 text-amber-800 mb-1">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide text-[#78350f]/60">
          {label}
        </span>
      </div>
      <p className="text-2xl font-bold text-[#451a03]">{value}</p>
    </div>
  )
}
