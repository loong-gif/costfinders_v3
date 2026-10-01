'use client'

import { Bell, Gear, Shield, SignOut, User } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAdminAuth } from '@/lib/context/adminAuthContext'

/**
 * Read-only statement of where an alert goes.
 *
 * These were toggles backed only by `useState`, and later "Always on" rows for alerts that did
 * not exist: no code has ever sent an admin a bell notification. Each row now says what
 * actually happens. There is no per-admin preference to store; the recipients are deployment
 * settings.
 */
function AlertRow({
  label,
  description,
  channel,
}: {
  label: string
  description: string
  channel: string
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border-default last:border-b-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-secondary mt-0.5">{description}</p>
      </div>
      <span className="inline-flex flex-shrink-0 items-center px-2.5 py-1 rounded-full bg-accent-muted text-xs font-medium text-accent-hover">
        {channel}
      </span>
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

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
            <Gear size={20} weight="duotone" className="text-text-secondary" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
              Admin settings
            </h1>
            <p className="text-sm text-text-secondary mt-0.5">
              Your account, alerts and session
            </p>
          </div>
        </div>
      </div>

      {/* Account Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
              <User
                size={20}
                weight="duotone"
                className="text-text-secondary"
              />
            </div>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your admin account details</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <div className="flex items-center justify-between gap-4 py-3 border-b border-border-default">
              <p className="text-sm text-text-secondary flex-shrink-0">Email</p>
              <p className="text-sm font-medium text-text-primary min-w-0 text-right break-all">
                {admin?.email ?? '—'}
              </p>
            </div>
            <div className="flex items-center justify-between gap-4 py-3 border-b border-border-default">
              <p className="text-sm text-text-secondary">Role</p>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent-muted text-xs font-medium text-accent-hover">
                <Shield size={14} weight="fill" />
                {admin?.role ? formatRole(admin.role) : '—'}
              </span>
            </div>
            <div className="py-3">
              <p className="text-sm text-text-secondary mb-2">Permissions</p>
              <div className="flex flex-wrap gap-2">
                {admin?.permissions && admin.permissions.length > 0 ? (
                  admin.permissions.map((permission) => (
                    <span
                      key={permission}
                      className="inline-flex items-center px-2.5 py-1 rounded-full bg-bg-elevated border border-border-default text-xs text-text-primary"
                    >
                      {formatPermission(permission)}
                    </span>
                  ))
                ) : (
                  <p className="text-sm text-text-muted">
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
            <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center">
              <Bell
                size={20}
                weight="duotone"
                className="text-text-secondary"
              />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Where alerts about customers and clinics go
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <AlertRow
              label="New customer claims"
              description="Each claim is emailed to the ops inbox, the address in the CLAIM_NOTIFICATION_EMAIL deployment setting, and appears on the Leads screen."
              channel="Email"
            />
            <AlertRow
              label="Listing requests"
              description="Requests from clinics to be added, corrected or removed are emailed to the address in LISTING_REQUEST_EMAIL, or the claim inbox when that is not set. They are also listed on the Businesses screen."
              channel="Email"
            />
            <AlertRow
              label="Bell notifications"
              description="Not used for admins. Nothing sends an admin a bell notification, so check Leads and your email instead."
              channel="Not used"
            />
            <p className="text-xs text-text-secondary mt-3">
              Alerts go to one shared inbox, not to each admin. The addresses
              are set in the hosting settings, not here.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Session Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-bg flex items-center justify-center">
              <SignOut size={20} weight="duotone" className="text-error" />
            </div>
            <div>
              <CardTitle>Session</CardTitle>
              <CardDescription>Manage your current session</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary">Sign out</p>
              <p className="text-sm text-text-secondary">
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
