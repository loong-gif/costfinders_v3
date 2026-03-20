import Link from 'next/link'
import { CaretRight } from '@phosphor-icons/react/dist/ssr'

export interface BreadcrumbItem {
  label: string
  href?: string  // Optional: no href = current page (no link)
}

interface BreadcrumbProps {
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Breadcrumb - Visual breadcrumb navigation component
 * Renders Home > Parent > Current style navigation
 *
 * Note: For JSON-LD structured data, use BreadcrumbSchema from @/components/seo
 */
export function Breadcrumb({ items, className = '' }: BreadcrumbProps) {
  return (
    <nav
      className={`mb-6 text-sm text-[#92400e] ${className}`}
      aria-label="Breadcrumb"
    >
      <ol className="flex items-center gap-2 flex-wrap">
        {items.map((item, index) => {
          const isLast = index === items.length - 1

          return (
            <li key={item.label} className="flex items-center gap-2">
              {index > 0 && (
                <CaretRight size={12} weight="bold" className="text-[#92400e]" />
              )}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="hover:text-[#451a03] transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span className={isLast ? 'text-[#451a03]' : ''}>
                  {item.label}
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
