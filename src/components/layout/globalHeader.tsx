'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { MagnifyingGlass, User, SignIn } from '@phosphor-icons/react'
import { LocationDisplay } from '@/components/layout/locationDisplay'
import { Button } from '@/components/ui/button'
import { AuthModal } from '@/components/features/authModal'
import { useAuth } from '@/lib/context/authContext'

type AuthView = 'signUp' | 'signIn'

export function GlobalHeader() {
  const pathname = usePathname()
  const { state } = useAuth()
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
      <header className="fixed top-0 left-0 right-0 z-40 bg-stone-950/95 backdrop-blur-sm border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <MagnifyingGlass
              size={22}
              weight="bold"
              className="text-amber-400"
            />
            <span className="font-bold text-lg text-amber-400">CostFinders</span>
          </Link>

          {/* Right side: Location + Auth */}
          <div className="flex items-center gap-4">
            <LocationDisplay />

            {state.isAuthenticated ? (
              <Link href="/dashboard">
                <Button variant="secondary" size="sm">
                  <User size={18} weight="bold" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              </Link>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSignIn}
                  className="text-sm text-stone-400 hover:text-stone-100 transition-colors hidden sm:block cursor-pointer"
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
