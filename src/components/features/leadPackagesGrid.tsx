'use client'

import { Star } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import type { CreditPackage } from '@/lib/mock-data/leadPricing'

interface LeadPackagesGridProps {
  packages: CreditPackage[]
  onSelectPackage: (pkg: CreditPackage) => void
}

export function LeadPackagesGrid({
  packages,
  onSelectPackage,
}: LeadPackagesGridProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-stone-100 mb-2">Buy more leads</h2>
      <p className="text-stone-400 mb-6">
        Purchase lead packages to save on per-lead costs
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {packages.map((pkg) => (
          <Card
            key={pkg.id}
            variant="glass"
            padding="none"
            className={`relative overflow-hidden ${pkg.isBestValue ? 'ring-2 ring-amber-400' : ''}`}
          >
            {/* Best Value Badge */}
            {pkg.isBestValue && (
              <div className="absolute top-0 right-0">
                <div className="bg-amber-400 text-white text-xs font-semibold px-3 py-1 rounded-bl-lg flex items-center gap-1">
                  <Star size={12} weight="fill" />
                  Best value
                </div>
              </div>
            )}

            <div className="p-5">
              {/* Lead Amount */}
              <div className="text-center mb-4">
                <p className="text-3xl font-bold text-stone-100">{pkg.credits}</p>
                <p className="text-sm text-stone-400">leads</p>
              </div>

              {/* Price */}
              <div className="text-center mb-4">
                <p className="text-2xl font-bold text-stone-100">${pkg.price}</p>
                <p className="text-sm text-stone-500">
                  ${pkg.pricePerLead.toFixed(2)} per lead
                </p>
              </div>

              {/* Savings Badge */}
              {pkg.savingsPercent > 0 && (
                <div className="flex justify-center mb-4">
                  <Badge variant="success" size="sm">
                    Save {pkg.savingsPercent}%
                  </Badge>
                </div>
              )}

              {/* Purchase Button */}
              <Button
                variant={pkg.isBestValue ? 'primary' : 'secondary'}
                size="md"
                className="w-full"
                onClick={() => onSelectPackage(pkg)}
              >
                Buy {pkg.credits} leads
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  )
}
