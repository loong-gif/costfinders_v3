'use client'

import { SignOut } from '@phosphor-icons/react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Tooltip } from '@/components/ui/tooltip'

export interface NavItem {
  href: string
  label: string
  icon: React.ComponentType<{ size?: number; weight?: 'light' | 'fill' }>
}

export interface BaseSidebarProps {
  navItems: NavItem[]
  baseRoute: string // e.g., '/dashboard', '/business/dashboard', '/admin/dashboard'
  user: {
    displayName: string
    initial: string
  } | null
  onSignOut: () => void
  mobileNavCount?: number // defaults to 5, how many items to show on mobile
}

export function BaseSidebar({
  navItems,
  baseRoute,
  user,
  onSignOut,
  mobileNavCount = 5,
}: BaseSidebarProps) {
  const pathname = usePathname()

  const isActive = (href: string) => {
    if (href === baseRoute) {
      return pathname === baseRoute
    }
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Desktop Sidebar - Icon Only */}
      <aside className="hidden md:flex fixed left-0 top-20 bottom-0 w-16 flex-col items-center bg-stone-900 border-r border-stone-800 z-40">
        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-2 flex flex-col items-center">
          {navItems.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Tooltip key={item.href} content={item.label} side="right">
                <Link
                  href={item.href}
                  className={`
                    flex items-center justify-center w-12 h-12 rounded-xl
                    transition-all duration-200
                    ${
                      active
                        ? 'bg-amber-400/10 text-amber-400'
                        : 'text-stone-400 hover:bg-stone-800 hover:text-stone-100'
                    }
                  `}
                >
                  <Icon size={24} weight={active ? 'fill' : 'light'} />
                </Link>
              </Tooltip>
            )
          })}
        </nav>

        {/* User Section */}
        <div className="py-4 border-t border-stone-800 space-y-2 flex flex-col items-center">
          {/* Avatar */}
          <Tooltip content={user?.displayName || 'User'} side="right">
            <div className="w-10 h-10 rounded-full bg-amber-400/20 flex items-center justify-center cursor-default">
              <span className="text-sm font-semibold text-amber-400">
                {user?.initial || 'U'}
              </span>
            </div>
          </Tooltip>

          {/* Sign Out */}
          <Tooltip content="Sign Out" side="right">
            <button
              type="button"
              onClick={onSignOut}
              className="flex items-center justify-center w-12 h-12 rounded-xl text-stone-400 hover:text-stone-100 hover:bg-stone-800 transition-all duration-200"
            >
              <SignOut size={24} weight="light" />
            </button>
          </Tooltip>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-800 z-50">
        <div className="flex items-center justify-around py-2">
          {navItems.slice(0, mobileNavCount).map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`
                  flex flex-col items-center gap-1 px-3 py-2 rounded-xl
                  transition-all duration-200
                  ${
                    active
                      ? 'text-amber-400'
                      : 'text-stone-400 hover:text-stone-100'
                  }
                `}
              >
                <Icon size={24} weight={active ? 'fill' : 'light'} />
                <span className="text-xs font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </>
  )
}
