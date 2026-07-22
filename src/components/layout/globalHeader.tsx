'use client'

import { SignIn, User } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback, useEffect, useState } from 'react'

const AuthModal = dynamic(
  () => import('@/components/features/authModal').then((m) => m.AuthModal),
  { ssr: false },
)

import { NotificationBell } from '@/components/patterns/notificationBell'
import { Button } from '@/components/ui/button'
import { safeDashboardPath } from '@/lib/auth-redirect'
import { useAuth } from '@/lib/context/authContext'
import { useScrolled } from '@/lib/hooks/useScrolled'

type AuthView = 'signUp' | 'signIn'

function GlobalHeaderInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useAuth()
  const scrolled = useScrolled(20)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalView, setModalView] = useState<AuthView>('signIn')
  const [pendingNext, setPendingNext] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('signin') !== 'required') return
    const next = safeDashboardPath(searchParams.get('next'))
    setPendingNext(next)
    setModalView('signIn')
    setIsModalOpen(true)
  }, [searchParams])

  const clearAuthQueryParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('signin')
    params.delete('next')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname)
  }, [pathname, router, searchParams])

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
    setPendingNext(null)
    if (searchParams.get('signin') === 'required') {
      clearAuthQueryParams()
    }
  }

  const handleAuthSuccess = () => {
    setIsModalOpen(false)
    const destination =
      pendingNext ?? safeDashboardPath(searchParams.get('next'))
    setPendingNext(null)
    clearAuthQueryParams()
    if (destination) {
      router.replace(destination)
    }
  }

  return (
    <>
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
        onSuccess={handleAuthSuccess}
      />
    </>
  )
}

export function GlobalHeader() {
  return (
    <Suspense fallback={null}>
      <GlobalHeaderInner />
    </Suspense>
  )
}
