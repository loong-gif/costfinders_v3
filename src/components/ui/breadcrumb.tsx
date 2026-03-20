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

function BreadcrumbLink({ item, isLast }: { item: BreadcrumbItem; isLast: boolean }) {
  if (item.href && !isLast) {
    return (
      <Link
        href={item.href}
        className="hover:text-[#451a03] transition-colors"
      >
        {item.label}
      </Link>
    )
  }
  return (
    <span className={isLast ? 'text-[#451a03]' : ''}>
      {item.label}
    </span>
  )
}

function Separator() {
  return <CaretRight size={12} weight="bold" className="text-[#92400e]" />
}

/**
 * Breadcrumb - Visual breadcrumb navigation component
 * Renders Home > Parent > Current style navigation
 *
 * On mobile (< md), collapses intermediate items to "..." when there are 3+ items,
 * showing only the first and last items.
 *
 * Note: For JSON-LD structured data, use BreadcrumbSchema from @/components/seo
 */
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  const shouldCollapse = items.length > 2

  // Mobile-collapsed items: first item > ... > last item
  const mobileItems = shouldCollapse
    ? [items[0], items[items.length - 1]]
    : items

  return (
    <nav
      className={`mb-6 text-sm text-[#92400e] ${className}`}
      aria-label="Breadcrumb"
    >
      {/* Desktop: show all items */}
      <ol className="hidden md:flex items-center gap-2 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={item.label} className="flex items-center gap-2">
              {index > 0 && <Separator />}
              <BreadcrumbLink item={item} isLast={isLast} />
            </li>
          )
        })}
      </ol>

      {/* Mobile: collapsed with ellipsis for intermediate items */}
      <ol className="flex md:hidden items-center gap-2 flex-wrap">
        {mobileItems.map((item, index) => {
          const isLast = index === mobileItems.length - 1
          return (
            <li key={item.label} className="flex items-center gap-2">
              {index > 0 && <Separator />}
              {/* Show ellipsis before the last item when collapsing */}
              {shouldCollapse && index === 1 && (
                <>
                  <DotsThree size={16} weight="bold" className="text-[#92400e]" />
                  <Separator />
                </>
              )}
              <BreadcrumbLink item={item} isLast={isLast} />
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
