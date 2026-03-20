'use client'

import Link from 'next/link'
import {
  CaretRight,
  Drop,
  Lightning,
  Sparkle,
  Syringe,
} from '@phosphor-icons/react'
import type { AnonymousDeal } from '@/types/deal'
import type { Category } from '@/lib/mock-data/categories'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

// Map category icon names to Phosphor components
const iconMap: Record<string, React.ComponentType<{ size?: number; weight?: 'light' | 'fill'; className?: string }>> = {
  Syringe,
  Drop,
  Sparkle,
  Lightning,
}

interface CategoryPreviewCardProps {
  category: Category
  deals: AnonymousDeal[]
}

export function CategoryPreviewCard({ category, deals }: CategoryPreviewCardProps) {
  const Icon = iconMap[category.icon] || Syringe

  return (
    <Card hover className="h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20">
            <Icon size={20} weight="light" className="text-brand-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-text-primary">{category.name}</h3>
            <p className="text-xs text-text-tertiary">{category.dealCount} deals</p>
          </div>
        </div>
        <Link
          href={`/deals?category=${category.slug}`}
          className="flex items-center gap-1 text-sm text-brand-primary hover:text-brand-secondary transition-colors"
        >
          See all
          <CaretRight size={14} weight="bold" />
        </Link>
      </div>

      {/* Deal previews */}
      <div className="space-y-1">
        {deals.map((deal) => (
          <Link
            key={deal.id}
            href={`/deals/${deal.id}`}
            className="flex items-center justify-between py-2.5 px-2 -mx-2 rounded-lg hover:bg-glass-bg-hover transition-colors"
          >
            <div className="flex-1 min-w-0 mr-3">
              <p className="font-medium text-sm text-text-primary truncate">
                {deal.title}
              </p>
              <p className="text-xs text-text-tertiary truncate">
                {deal.locationArea}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="font-bold text-brand-primary">
                ${deal.dealPrice}
              </span>
              <Badge variant="brand" size="sm">
                {deal.discountPercent}% off
              </Badge>
            </div>
          </Link>
        ))}

        {deals.length === 0 && (
          <p className="text-sm text-text-tertiary py-4 text-center">
            No deals available
          </p>
        )}
      </div>
    </Card>
  )
}
