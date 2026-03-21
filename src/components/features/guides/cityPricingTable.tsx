import type { GuidePricingStats } from '@/types/guide'

interface CityPricingTableProps {
  treatmentLabel: string
  cityLabel: string
  stats: GuidePricingStats
}

export function CityPricingTable({
  treatmentLabel,
  cityLabel,
  stats,
}: CityPricingTableProps) {
  const templateRows = stats.byTemplateType.filter((t) => t.count > 0)
  const unitRows = stats.byUnitType.filter((u) => u.count > 0)

  return (
    <section className="mb-10">
      <h2 className="text-2xl font-bold text-[#451a03] mb-3">
        Average {treatmentLabel} cost in {cityLabel}
      </h2>
      <p className="text-[#78350f]/80 mb-6">
        Real pricing data from {stats.providerCount} verified provider
        {stats.providerCount !== 1 ? 's' : ''} offering {stats.dealCount} active
        deal{stats.dealCount !== 1 ? 's' : ''}.
      </p>

      {templateRows.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-[#78350f]/60 uppercase tracking-wide mb-3">
            By offer type
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#d4c4b0]">
                  <th className="text-left py-3 pr-4 text-[#78350f]/60 font-medium">
                    Type
                  </th>
                  <th className="text-right py-3 px-4 text-[#78350f]/60 font-medium">
                    Deals
                  </th>
                  <th className="text-right py-3 px-4 text-[#78350f]/60 font-medium">
                    Low
                  </th>
                  <th className="text-right py-3 px-4 text-[#78350f]/60 font-medium">
                    Average
                  </th>
                  <th className="text-right py-3 pl-4 text-[#78350f]/60 font-medium">
                    High
                  </th>
                </tr>
              </thead>
              <tbody>
                {templateRows.map((row) => (
                  <tr
                    key={row.templateType}
                    className="border-b border-[#d4c4b0]/50"
                  >
                    <td className="py-3 pr-4 text-[#451a03] font-medium">
                      {formatTemplateType(row.templateType)}
                    </td>
                    <td className="py-3 px-4 text-right text-[#78350f]/80">
                      {row.count}
                    </td>
                    <td className="py-3 px-4 text-right text-[#78350f]/80">
                      {row.minPrice != null ? `$${row.minPrice}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold text-amber-800">
                      {row.avgPrice != null ? `$${row.avgPrice}` : '—'}
                    </td>
                    <td className="py-3 pl-4 text-right text-[#78350f]/80">
                      {row.maxPrice != null ? `$${row.maxPrice}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {unitRows.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#78350f]/60 uppercase tracking-wide mb-3">
            By pricing unit
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {unitRows.map((row) => (
              <div
                key={row.unitType}
                className="bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-4"
              >
                <p className="text-xs font-medium text-[#78350f]/60 uppercase tracking-wide mb-1">
                  Per {row.unitType}
                </p>
                <p className="text-xl font-bold text-[#451a03]">
                  {row.avgPrice != null ? `$${row.avgPrice}` : '—'}
                </p>
                <p className="text-xs text-[#78350f]/50">
                  {row.count} deal{row.count !== 1 ? 's' : ''}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatTemplateType(type: string): string {
  const labels: Record<string, string> = {
    FIXED_PRICE: 'Fixed price',
    DISCOUNT: 'Discounted',
    BUNDLE: 'Bundle',
    MEMBERSHIP: 'Membership',
    COMPLIMENTARY: 'Complimentary',
    OTHER: 'Other',
  }
  return labels[type] ?? type
}
