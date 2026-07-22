'use client'

import { SignIn, User } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)

import { NotificationBell } from '@/components/patterns/notificationBell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import { useScrolled } from '@/lib/hooks/useScrolled'

type AuthView = 'signUp' | 'signIn'

export function GlobalHeader() {
  const pathname = usePathname()
  const { state } = useAuth()
  const scrolled = useScrolled(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<AuthView>('signIn')

  // Hide on all dashboard pages (they have their own navigation)
  if (
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/business/dashboard') ||
    pathname.startsWith('/admin/dashboard')
  ) {
    return null
  }

  const handleSignIn = () => {
    setModalView('signIn')
    setIsModalOpen(true)
  }

  const handleSignUp = () => {
    setModalView('signUp')
    setIsModalOpen(true)
  }

  const handleClose = () => {
    setIsModalOpen(false)
  }

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-40 bg-[#e8ddd0]/95 backdrop-blur-sm border-b border-[#d4c4b0] transition-shadow duration-300 ${scrolled ? 'shadow-[0_4px_20px_rgba(69,26,3,0.08)]' : ''}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/icon.webp"
              alt="CostFinders"
              width={36}
              height={36}
              priority
            />
            <span className="font-bold text-xl text-amber-800">
              CostFinders
            </span>
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

          {/* Right side: Auth */}
          <div className="flex items-center gap-4">
            {state.isAuthenticated ? (
              <>
                <NotificationBell />
                <Link href="/dashboard">
                  <Button variant="secondary" size="sm">
                    <User size={18} weight="bold" />
                    <span className="hidden sm:inline">Dashboard</span>
                  </Button>
                </Link>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="text-sm text-[#78350f] hover:text-[#451a03] transition-colors hidden sm:flex items-center justify-center min-h-[44px] px-3 cursor-pointer"
                >
                  Sign in
                </button>
                <Button variant="primary" size="sm" onClick={handleSignUp}>
                  <SignIn size={18} weight="bold" />
                  <span className="hidden sm:inline">Get Started</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <AuthModal
        isOpen={isModalOpen}
        onClose={handleClose}
        initialView={modalView}
        onSuccess={handleClose}
      />
    </>
  )
}
