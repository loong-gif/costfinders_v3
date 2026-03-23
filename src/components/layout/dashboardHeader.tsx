'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NotificationBell } from '@/components/patterns/notificationBell'
import { useAuth } from '@/lib/context/authContext'
import { useScrolled } from '@/lib/hooks/useScrolled'

const navLinks = [
  { href: '/deals', label: 'Deals' },
  { href: '/treatments', label: 'Treatments' },
]

export function DashboardHeader() {
  const { state } = useAuth()
  const scrolled = useScrolled(20)
  const pathname = usePathname()
  const user = state.user

  const initial =
    user?.firstName?.[0]?.toUpperCase() ||
    user?.email?.[0]?.toUpperCase() ||
    'U'
  const displayName = user?.firstName || 'Account'

  return (
    <header
      className={`fixed top-0 left-0 right-0 md:left-16 z-40 bg-[#e8ddd0]/95 backdrop-blur-sm border-b border-[#d4c4b0] transition-shadow duration-300 ${scrolled ? 'shadow-[0_4px_20px_rgba(69,26,3,0.08)]' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Logo + Nav Links */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/icon.webp" alt="CostFinders" width={32} height={32} />
            <span className="font-bold text-lg text-amber-800">
              CostFinders
            </span>
          </Link>

          {/* Nav links — hidden on mobile */}
          <nav className="hidden md:flex items-center gap-4">
            {navLinks.map((link) => {
              const isActive = pathname.startsWith(link.href)
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-amber-800'
                      : 'text-[#78350f] hover:text-[#451a03]'
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Notifications + User */}
        <div className="flex items-center gap-3">
          <NotificationBell />
          <Link
            href="/dashboard/settings"
            className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
          >
          <div className="w-8 h-8 rounded-full bg-amber-800/15 flex items-center justify-center">
            <span className="text-xs font-semibold text-amber-800">
              {initial}
            </span>
          </div>
          <span className="hidden sm:block text-sm font-medium text-[#451a03]">
            {displayName}
          </span>
        </Link>
        </div>
      </div>
    </header>
  )
}
