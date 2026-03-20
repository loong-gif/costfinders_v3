'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { ArrowLeft, CaretRight } from '@phosphor-icons/react'
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
      {/* Breadcrumbs - hidden on mobile, shown on tablet+ */}
      {breadcrumbs.length > 1 && (
        <nav className="hidden sm:flex items-center gap-1.5 text-sm mb-2" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, index) => (
            <div key={crumb.href} className="flex items-center gap-1.5">
              {index > 0 && (
                <CaretRight size={14} weight="bold" className="text-stone-500" />
              )}
              {crumb.isCurrentPage ? (
                <span className="text-stone-100 font-medium">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-stone-400 hover:text-stone-100 transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </div>
          ))}
        </nav>
      )}

      {/* Title with optional back button */}
      <div className="flex items-center gap-3">
        {shouldShowBack && (
          <button
            type="button"
            onClick={handleBack}
            className="p-2 -ml-2 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800/50 transition-all"
            aria-label="Go back"
          >
            <ArrowLeft size={20} weight="light" />
          </button>
        )}
        <h1 className="text-2xl font-bold text-stone-100">{pageTitle}</h1>
      </div>
    </div>
  )
}
