'use client'

import {
  Bell,
  CheckCircle,
  DownloadSimple,
  SignOut,
  Trash,
  User,
  Warning,
} from '@phosphor-icons/react'
import { useState } from 'react'
import { AlertPreferences } from '@/components/features/alertPreferences'
import { ProfileForm } from '@/components/features/profileForm'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  exportMyDataAction,
  requestAccountDeletionAction,
} from '@/lib/actions/profile'
import { useAuth } from '@/lib/context/authContext'

/**
 * Download a JSON payload as a file.
 *
 * ponytail: object URL + a synthetic click, no library. The upgrade path if exports ever
 * outgrow memory is a route handler streaming the body, but a single account's rows are
 * kilobytes.
 */
function downloadJson(filename: string, payload: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function DataExportRow() {
  const [status, setStatus] = useState<'idle' | 'working' | 'error'>('idle')
  const [error, setError] = useState<string>()

  const handleExport = async () => {
    setStatus('working')
    setError(undefined)
    const result = await exportMyDataAction()
    if (!result.success || !result.data) {
      setStatus('error')
      setError(result.error ?? "We couldn't build your export.")
      return
    }
    downloadJson(
      `costfinders-data-${new Date().toISOString().slice(0, 10)}.json`,
      result.data,
    )
    setStatus('idle')
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border-default">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text-primary">
          Download your data
        </p>
        <p className="text-sm text-text-secondary">
          Your profile, claims, saved deals, messages you sent, and
          notifications, as a JSON file
        </p>
        {status === 'error' && (
          <p className="mt-1 text-sm text-error">{error}</p>
        )}
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleExport}
        isLoading={status === 'working'}
        disabled={status === 'working'}
      >
        <DownloadSimple size={16} weight="bold" />
        Download
      </Button>
    </div>
  )
}

function DeleteAccountRow() {
  const [open, setOpen] = useState(false)
  const [confirmation, setConfirmation] = useState('')
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string>()
  const [done, setDone] = useState(false)

  const handleDelete = async () => {
    setWorking(true)
    setError(undefined)
    try {
      const result = await requestAccountDeletionAction(confirmation)
      if (!result.success || !result.removed) {
        setError(result.error ?? 'Something went wrong. Please try again.')
        return
      }
      // No signOut() here: the action already cleared the session cookie, and signing the
      // client out flips the dashboard layout to "We couldn't open this dashboard" and
      // redirects before anyone can read the confirmation below. Its button does a full page
      // load instead, which resets every auth context from the (now empty) cookie.
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setWorking(false)
    }
  }

  if (done) {
    return (
      <div className="py-3">
        <div className="flex items-start gap-3">
          <CheckCircle
            size={20}
            weight="duotone"
            className="text-savings shrink-0 mt-0.5"
          />
          <div className="min-w-0">
            <p className="text-sm font-medium text-text-primary">
              Your account has been deleted
            </p>
            <p className="mt-1 text-sm text-text-secondary">
              We deleted your login and everything linked to it. You&apos;ve
              been signed out.
            </p>
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => window.location.assign('/')}
            >
              Go to the homepage
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary">
            Delete my account
          </p>
          <p className="text-sm text-text-secondary">
            Removes your login and everything linked to it: your profile, saved
            deals, claims, messages and notifications.
          </p>
        </div>
        {!open && (
          <Button
            variant="danger"
            size="sm"
            onClick={() => setOpen(true)}
            className="shrink-0"
          >
            <Trash size={16} weight="bold" />
            Delete my account
          </Button>
        )}
      </div>

      {open && (
        <div className="mt-4 rounded-xl border border-border-default bg-bg-tertiary p-4">
          <div className="flex items-start gap-2">
            <Warning
              size={18}
              weight="duotone"
              className="text-warning shrink-0 mt-0.5"
            />
            <div className="min-w-0 text-sm text-text-secondary space-y-2">
              <p className="font-medium text-text-primary">
                This can't be undone.
              </p>
              {/* Matches delete_own_account(): the auth user is deleted and profiles,
                  saved deals, notifications, claims, conversations and messages go
                  with it by ON DELETE CASCADE. Nothing is kept. */}
              <p>
                We&apos;ll delete your login, your profile, your saved deals and
                notifications, the deals you&apos;ve claimed, and your messages.
                You&apos;ll be signed out.
              </p>
            </div>
          </div>

          <div className="mt-4 max-w-xs">
            <Input
              label="Type DELETE to confirm"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder="DELETE"
              error={error}
              disabled={working}
              autoComplete="off"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              isLoading={working}
              disabled={
                working || confirmation.trim().toUpperCase() !== 'DELETE'
              }
            >
              <Trash size={16} weight="bold" />
              Delete my account
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setOpen(false)
                setConfirmation('')
                setError(undefined)
              }}
              disabled={working}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function SettingsPage() {
  const { signOut } = useAuth()

  return (
    <div className="space-y-8">
      {/* Profile Section */}
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
              <CardTitle>Profile</CardTitle>
              <CardDescription>
                Update your personal information
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ProfileForm />
        </CardContent>
      </Card>

      {/* Notifications Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-savings-bg flex items-center justify-center">
              <Bell size={20} weight="duotone" className="text-savings" />
            </div>
            <div>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Control how CostFinders contacts you about your claims
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AlertPreferences />
        </CardContent>
      </Card>

      {/* Account Section */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-error-bg flex items-center justify-center">
              <SignOut size={20} weight="duotone" className="text-error" />
            </div>
            <div>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 py-3 border-b border-border-default">
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary">
                  Sign out
                </p>
                <p className="text-sm text-text-secondary">
                  Sign out of your account on this device
                </p>
              </div>
              <Button variant="secondary" size="sm" onClick={signOut}>
                <SignOut size={16} weight="bold" />
                Sign out
              </Button>
            </div>

            <DataExportRow />

            <DeleteAccountRow />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
