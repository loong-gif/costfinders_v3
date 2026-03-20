'use client'

import Link from 'next/link'
import {
  Heart,
  ClipboardText,
  MagnifyingGlass,
  UserCircle,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/context/authContext'
import type { Metadata } from 'next'

function getVerificationBadge(status: string | undefined) {
  switch (status) {
    case 'fully_verified':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/10 text-emerald-600 text-sm font-medium">
          <CheckCircle size={16} weight="fill" />
          Fully Verified
        </div>
      )
    case 'email_verified':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-800/8 text-amber-800 text-sm font-medium">
          <WarningCircle size={16} weight="fill" />
          Email Verified
        </div>
      )
    case 'phone_verified':
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-800/8 text-amber-800 text-sm font-medium">
          <WarningCircle size={16} weight="fill" />
          Phone Verified
        </div>
      )
    default:
      return (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-400/10 text-red-600 text-sm font-medium">
          <WarningCircle size={16} weight="fill" />
          Unverified
        </div>
      )
  }
}

export default function DashboardPage() {
  const { state } = useAuth()
  const user = state.user

  const greeting = user?.firstName ? `Welcome back, ${user.firstName}` : 'Welcome back'
  const isFullyVerified = user?.verificationStatus === 'fully_verified'

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">{greeting}</h1>
        <p className="text-[#78350f] mt-1">Here&apos;s an overview of your activity</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Saved Deals */}
        <Card variant="glass" padding="lg">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <Heart size={24} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#451a03]">0</p>
                <p className="text-sm text-[#78350f]">Saved Deals</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Active Claims */}
        <Card variant="glass" padding="lg">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                <ClipboardText size={24} weight="fill" className="text-emerald-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[#451a03]">0</p>
                <p className="text-sm text-[#78350f]">Active Claims</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Status */}
        <Card variant="glass" padding="lg">
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-400/10 flex items-center justify-center">
                <UserCircle size={24} weight="fill" className="text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-[#78350f] mb-1">Account Status</p>
                {getVerificationBadge(user?.verificationStatus)}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#451a03]">Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <Link href="/deals">
            <Button variant="primary" size="md">
              <MagnifyingGlass size={18} weight="bold" />
              Browse Deals
            </Button>
          </Link>
          {!isFullyVerified && (
            <Link href="/dashboard/settings">
              <Button variant="secondary" size="md">
                <UserCircle size={18} weight="bold" />
                Complete Profile
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Empty State Prompt */}
      <Card variant="glass" padding="lg">
        <CardContent>
          <div className="text-center py-8 space-y-4">
            <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center mx-auto">
              <MagnifyingGlass size={32} weight="light" className="text-amber-800" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold text-[#451a03]">
                Start Exploring Deals
              </h3>
              <p className="text-[#78350f] max-w-md mx-auto">
                Browse medspa deals in your area, save your favorites, and claim exclusive pricing.
              </p>
            </div>
            <Link href="/deals">
              <Button variant="primary" size="lg">
                Find Deals Near You
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
