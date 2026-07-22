'use client'

import { Bell, Gear, Shield, SignOut, User } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminAuth } from '@/lib/context/adminAuthContext'

interface ToggleRowProps {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#d4c4b0] last:border-b-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-[#451a03]">{label}</p>
        <p className="text-sm text-[#78350f] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-amber-800' : 'bg-[#d4c4b0]'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={onToggle}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

function formatRole(role: string): string {
  return role
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function formatPermission(permission: string): string {
  return permission
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export default function AdminSettingsPage() {
  const { state, signOut } = useAdminAuth()
  const admin = state.admin

  const [claimAlerts, setClaimAlerts] = useState(true)
  const [dealReviewAlerts, setDealReviewAlerts] = useState(true)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
            <Gear size={20} weight="duotone" className="text-amber-800" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-[#451a03]">
              Admin Settings
            </h1>
            <p className="text-sm text-[#78350f] mt-0.5">
              Manage your admin account and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <User size={20} weight="duotone" className="text-amber-800" />
            </div>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your admin account details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <div className="flex items-center justify-between py-3 border-b border-[#d4c4b0]">
              <p className="text-sm text-[#78350f]">Email</p>
              <p className="text-sm font-medium text-[#451a03]">
                {admin?.email ?? '—'}
              </p>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-[#d4c4b0]">
              <p className="text-sm text-[#78350f]">Role</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-800/8 text-xs font-medium text-amber-800">
                <Shield size={14} weight="fill" />
                {admin?.role ? formatRole(admin.role) : '—'}
              </span>
            </div>
            <div className="py-3">
              <p className="text-sm text-[#78350f] mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {admin?.permissions && admin.permissions.length > 0 ? (
                  admin.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-[#faf5ee] border border-[#d4c4b0] text-xs text-[#451a03]"
                    >
                      {formatPermission(permission)}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-[#78350f]/60">
                    No permissions assigned
                  </p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Notification Preferences */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <Bell size={20} weight="duotone" className="text-amber-800" />
            </div>
            <div>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how you receive alerts about platform activity
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <ToggleRow
              label="New claim alerts"
              description="Get notified for new business ownership claims"
              enabled={claimAlerts}
              onToggle={() => setClaimAlerts((prev) => !prev)}
            />
            <ToggleRow
              label="Deal review alerts"
              description="Get notified when deals are submitted for review"
              enabled={dealReviewAlerts}
              onToggle={() => setDealReviewAlerts((prev) => !prev)}
            />
            <ToggleRow
              label="In-app notifications"
              description="Show notifications in the bell icon"
              enabled={true}
              onToggle={() => {}}
              disabled
            />
            <p className="text-xs text-[#78350f]/60 mt-3">
              In-app notifications are always enabled. Notification preferences
              are enabled by default.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-400/10 flex items-center justify-center">
              <SignOut size={20} weight="duotone" className="text-red-600" />
            </div>
            <div>
              <CardTitle>Session</CardTitle>
              <CardDescription>Manage your current session</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-[#451a03]">Sign out</p>
              <p className="text-sm text-[#78350f]">
                Sign out of your admin account on this device
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={signOut}>
              <SignOut size={16} weight="bold" />
              Sign out
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
