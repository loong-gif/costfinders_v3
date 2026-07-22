'use client'

import { SignIn } from '@phosphor-icons/react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useScrolled } from '@/lib/hooks/useScrolled'

export function PublicHeader() {
  const pathname = usePathname()
  const scrolled = useScrolled(20)

  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/business/dashboard') ||
    pathname.startsWith('/admin/dashboard')
  ) {
    return null
  }

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-40 bg-[#e8ddd0]/95 backdrop-blur-sm border-b border-[#d4c4b0] transition-shadow duration-300 ${scrolled ? 'shadow-[0_4px_20px_rgba(69,26,3,0.08)]' : ''}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/icon.webp"
            alt="CostFinders"
            width={36}
            height={36}
            priority
          />
          <span className="font-bold text-xl text-amber-800">CostFinders</span>
        </Link>

        <nav className="hidden items-center gap-5 text-sm font-medium text-[#78350f] md:flex">
          <Link
            href="/prices"
            className="transition-colors hover:text-[#451a03]"
          >
            Compare prices
          </Link>
          <Link
            href="/promotions"
            className="transition-colors hover:text-[#451a03]"
          >
            Promotions
          </Link>
          <Link
            href="/businesses"
            className="transition-colors hover:text-[#451a03]"
          >
            Businesses
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/dashboard?signin=required"
            className="text-sm text-[#78350f] hover:text-[#451a03] transition-colors hidden sm:flex items-center justify-center min-h-[44px] px-3"
          >
            Sign in
          </Link>
          <Link href="/dashboard?signin=required">
            <Button variant="primary" size="sm">
              <SignIn size={18} weight="bold" />
              <span className="hidden sm:inline">Get Started</span>
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
