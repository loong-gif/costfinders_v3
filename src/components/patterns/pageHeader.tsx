'use client'

import { ArrowLeft, CaretRight } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getBreadcrumbs } from '@/lib/routes'

interface PageHeaderProps {
  /** Override the auto-generated title */
  title?: string
  /** Show back button (auto-detected if not provided) */
  showBack?: boolean
  /** Custom back URL (defaults to parent route) */
  backUrl?: string
}

export function PageHeader({ title, showBack, backUrl }: PageHeaderProps) {
  const pathname = usePathname()
  const router = useRouter()
  const breadcrumbs = getBreadcrumbs(pathname)

  // Determine if we should show back button
  const hasParent = breadcrumbs.length > 1
  const shouldShowBack = showBack ?? hasParent
  const parentUrl = backUrl ?? breadcrumbs[breadcrumbs.length - 2]?.href

  // Get current page title
  const currentBreadcrumb = breadcrumbs[breadcrumbs.length - 1]
  const pageTitle = title ?? currentBreadcrumb?.label ?? 'Dashboard'

  // Don't render if on root dashboard (no breadcrumbs to show)
  if (breadcrumbs.length <= 1 && !title) {
    return null
  }

  const handleBack = () => {
    if (parentUrl) {
      router.push(parentUrl)
    } else {
      router.back()
    }
  }

  return (
    <div className="mb-6">
      {/* Breadcrumbs - collapsed on mobile (first + last), full on tablet+ */}
      {breadcrumbs.length > 1 && (
        <>
          {/* Desktop: full breadcrumb trail */}
          <nav
            className="hidden sm:flex items-center gap-1.5 text-sm mb-2"
            aria-label="Breadcrumb"
          >
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center gap-1.5">
                {index > 0 && (
                  <CaretRight
                    size={14}
                    weight="bold"
                    className="text-[#92400e]"
                  />
                )}
                {crumb.isCurrentPage ? (
                  <span className="text-[#451a03] font-medium">
                    {crumb.label}
                  </span>
                ) : (
                  <Link
                    href={crumb.href}
                    className="text-[#78350f] hover:text-[#451a03] transition-colors"
                  >
                    {crumb.label}
                  </Link>
                )}
              </div>
            ))}
          </nav>

          {/* Mobile: show parent link as compact breadcrumb */}
          <nav
            className="flex sm:hidden items-center gap-1.5 text-sm mb-2"
            aria-label="Breadcrumb"
          >
            <Link
              href={breadcrumbs[breadcrumbs.length - 2]?.href || '/'}
              className="text-[#78350f] hover:text-[#451a03] transition-colors"
            >
              {breadcrumbs[breadcrumbs.length - 2]?.label}
            </Link>
            <CaretRight
              size={14}
              weight="bold"
              className="text-[#92400e]"
            />
            <span className="text-[#451a03] font-medium truncate">
              {breadcrumbs[breadcrumbs.length - 1]?.label}
            </span>
          </nav>
        </>
      )}

      {/* Title with optional back button */}
      <div className="flex items-center gap-3">
        {shouldShowBack && (
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl text-[#78350f] hover:text-[#451a03] hover:bg-[#d4c4b0]/30 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft size={20} weight="light" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-[#451a03]">{pageTitle}</h1>
      </div>
    </div>
  )
}
