import { CaretRight, DotsThree } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

export interface BreadcrumbItem {
  label: string
  href?: string // Optional: no href = current page (no link)
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

function BreadcrumbLink({
  item,
  isLast,
}: {
  item: BreadcrumbItem
  isLast: boolean
}) {
  if (item.href && !isLast) {
    return (
      <Link
        href={item.href}
        className="inline-flex items-center py-1 hover:text-text-primary transition-colors"
      >
        {item.label}
      </Link>
    )
  }
  return (
    <span
      aria-current={isLast ? 'page' : undefined}
      className={isLast ? 'text-text-primary' : ''}
    >
      {item.label}
    </span>
  )
}

function Separator() {
  return (
    <CaretRight
      size={12}
      weight="bold"
      aria-hidden="true"
      className="text-text-muted shrink-0"
    />
  )
}

/**
 * Breadcrumb - Visual breadcrumb navigation component
 * Renders Home > Parent > Current style navigation
 *
 * On mobile (< md), trails longer than three levels collapse to
 * "first > ... > parent > current". The immediate parent stays visible because
 * it is the link people actually use to go back up a level.
 *
 * Each separator trails the crumb before it, in the same <li>, so a trail that wraps breaks
 * after a "›", never before one. Leading separators left "› Botox in Santa Ana" alone on a
 * second line at 320px (device matrix, 2026-09-28).
 *
 * Note: For JSON-LD structured data, use BreadcrumbSchema from @/components/seo
 */
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const shouldCollapse = items.length > 3

  const mobileItems = shouldCollapse ? [items[0], ...items.slice(-2)] : items

  return (
    <nav
      className={`mb-6 text-sm text-text-muted ${className}`}
      aria-label="Breadcrumb"
    >
      {/* Desktop: show all items */}
      <ol className="hidden md:flex items-center gap-x-2 gap-y-1 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li
              key={`${item.href ?? 'current'}-${item.label}`}
              className="flex items-center gap-2"
            >
              <BreadcrumbLink item={item} isLast={isLast} />
              {!isLast && <Separator />}
            </li>
          )
        })}
      </ol>

      {/* Mobile: collapsed with ellipsis for intermediate items */}
      <ol className="flex md:hidden items-center gap-x-2 gap-y-1 flex-wrap">
        {mobileItems.map((item, index) => {
          const isLast = index === mobileItems.length - 1
          return (
            <li
              key={`${item.href ?? 'current'}-${item.label}`}
              className="flex items-center gap-2"
            >
              {/* Stand-in for the levels skipped between home and the parent */}
              {shouldCollapse && index === 1 && (
                <>
                  <DotsThree
                    size={16}
                    weight="bold"
                    aria-hidden="true"
                    className="text-text-muted shrink-0"
                  />
                  <Separator />
                </>
              )}
              <BreadcrumbLink item={item} isLast={isLast} />
              {!isLast && <Separator />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
