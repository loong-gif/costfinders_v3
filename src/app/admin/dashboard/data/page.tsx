'use client'

import {
  ArrowClockwise,
  Buildings,
  ClipboardText,
  FileArrowDown,
  Users,
  Warning,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { logAdminAction } from '@/lib/actions/audit'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'

type ExportFormat = 'csv' | 'json'
type DateRange = '30days' | 'all'
type UserFilter = 'all' | 'verified'
type ExportKey = 'deals' | 'businesses' | 'users'

interface AuditEntry {
  id: string
  admin_email: string | null
  action: string
  target_type: string | null
  target_id: string | null
  details: Record<string, unknown> | null
  created_at: string
}

interface ExportNote {
  tone: 'success' | 'error'
  text: string
}

// Matches the definition of "verified" used on /admin/dashboard/users.
const VERIFIED_STATUSES = ['fully_verified', 'email_verified', 'phone_verified']

/**
 * The users export is an explicit column list, not select('*').
 *
 * profiles.unsubscribe_token is a bearer credential: it is the only thing the
 * /unsubscribe endpoint checks (src/app/unsubscribe/page.tsx and
 * src/lib/email/optOut.ts), so anyone holding it can opt that person out without
 * authenticating. One click on "Export users" used to write all of them to a CSV
 * on the admin's laptop. The subject-access export already strips the same field
 * (src/lib/actions/profile.ts). Phone numbers stay — an admin export is a
 * legitimate place for them, unlike a credential.
 *
 * Keep this a list, not a star: the next column added to profiles should have to
 * be named here before it leaves the database.
 */
const USER_EXPORT_COLUMNS =
  'id, first_name, last_name, phone, phone_verified_at, verification_status, status, location_city, location_state, alerts_email, alerts_sms, favorite_categories, created_at, updated_at, last_login_at, deletion_requested_at'

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000

type PageFetcher = (
  from: number,
  to: number,
) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>

/**
 * PostgREST returns at most 1000 rows per request, so a single select silently
 * truncates the 1,900+ row offers table. Page until a short page comes back.
 */
async function fetchAllRows(page: PageFetcher) {
  const rows: Record<string, unknown>[] = []

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    rows.push(...(data as Record<string, unknown>[]))
    if (data.length < PAGE_SIZE) break
  }

  return rows
}

function toCsv(rows: Record<string, unknown>[]): string {
  const headers = Object.keys(rows[0])

  const escapeCell = (value: unknown): string => {
    if (value === null || value === undefined) return ''
    const text =
      typeof value === 'object' ? JSON.stringify(value) : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }

  return [
    headers.join(','),
    ...rows.map((row) =>
      headers.map((header) => escapeCell(row[header])).join(','),
    ),
  ].join('\n')
}

function downloadFile(filename: string, contents: string, mime: string) {
  const url = URL.createObjectURL(new Blob([contents], { type: mime }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function humanize(value: string): string {
  const text = value.replace(/_/g, ' ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

function formatTimestamp(dateString: string): string {
  const date = new Date(dateString)
  const diffMs = Date.now() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

  if (diffHours < 1) {
    const mins = Math.floor(diffMs / (1000 * 60))
    return mins <= 1 ? 'Just now' : `${mins}m ago`
  }
  if (diffHours < 24) return `${diffHours}h ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function describeTarget(entry: AuditEntry): string {
  const parts: string[] = []
  if (entry.target_type) parts.push(humanize(entry.target_type))
  if (entry.target_id) parts.push(`#${entry.target_id}`)
  if (entry.details && Object.keys(entry.details).length > 0) {
    parts.push(
      Object.entries(entry.details)
        .map(([key, value]) => `${key.replace(/_/g, ' ')}: ${String(value)}`)
        .join(', '),
    )
  }
  return parts.join(' — ') || '—'
}

// ---------------------------------------------------------------------------
// Activity filters — keyed on the target_type values the audit log actually writes
// ---------------------------------------------------------------------------

// 'lead' is every lead-relay action (relayed, undone, closed, reopened, extended) in
// admin-leads.ts. 'claim' is a business-ownership claim, not a customer's. The Content filter
// went with the Content screens it pointed at.
const activityFilters = [
  { id: 'all', label: 'All', types: null },
  { id: 'leads', label: 'Lead relay', types: ['lead'] },
  { id: 'deals', label: 'Deals', types: ['deal'] },
  {
    id: 'businesses',
    label: 'Businesses',
    types: ['business', 'listing_request'],
  },
  { id: 'claims', label: 'Ownership claims', types: ['claim'] },
  { id: 'users', label: 'Users', types: ['user'] },
  { id: 'exports', label: 'Exports', types: ['export'] },
] as const

type ActivityFilterId = (typeof activityFilters)[number]['id']

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------

function FormatToggle({
  value,
  onChange,
  name,
}: {
  value: ExportFormat
  onChange: (format: ExportFormat) => void
  name: string
}) {
  return (
    <div>
      <p className="text-sm text-text-secondary mb-1">Format</p>
      <div className="flex gap-2">
        {(['csv', 'json'] as const).map((format) => (
          <button
            key={format}
            type="button"
            aria-pressed={value === format}
            onClick={() => onChange(format)}
            className={`min-h-[44px] px-4 text-sm rounded-lg transition-colors ${
              value === format
                ? 'bg-text-primary text-white'
                : 'bg-bg-surface text-text-secondary hover:bg-bg-elevated'
            }`}
          >
            {format.toUpperCase()}
            <span className="sr-only"> format for {name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

function ExportNoteLine({ note }: { note: ExportNote | undefined }) {
  if (!note) return null
  return (
    <output
      className={`block text-sm ${note.tone === 'error' ? 'text-error' : 'text-success'}`}
    >
      {note.text}
    </output>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DataManagementPage() {
  const [formats, setFormats] = useState<Record<ExportKey, ExportFormat>>({
    deals: 'csv',
    businesses: 'csv',
    users: 'csv',
  })
  const [dealsDateRange, setDealsDateRange] = useState<DateRange>('30days')
  const [userFilter, setUserFilter] = useState<UserFilter>('all')

  const [busyExport, setBusyExport] = useState<ExportKey | null>(null)
  const [exportNotes, setExportNotes] = useState<
    Partial<Record<ExportKey, ExportNote>>
  >({})

  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [logLoading, setLogLoading] = useState(true)
  const [logError, setLogError] = useState<string | null>(null)
  const [activityFilter, setActivityFilter] = useState<ActivityFilterId>('all')

  const loadActivityLog = useCallback(async () => {
    setLogLoading(true)
    setLogError(null)

    const supabase = createSupabaseBrowserClient()
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select(
        'id, admin_email, action, target_type, target_id, details, created_at',
      )
      .order('created_at', { ascending: false })
      .limit(50)

    if (error) {
      setEntries(null)
      setLogError(error.message)
    } else {
      setEntries((data ?? []) as AuditEntry[])
    }
    setLogLoading(false)
  }, [])

  useEffect(() => {
    loadActivityLog()
  }, [loadActivityLog])

  const runExport = useCallback(
    async (key: ExportKey) => {
      setBusyExport(key)
      setExportNotes((prev) => ({ ...prev, [key]: undefined }))

      const supabase = createSupabaseBrowserClient()
      const format = formats[key]

      try {
        let rows: Record<string, unknown>[] = []

        if (key === 'deals') {
          const since = new Date(
            Date.now() - 30 * 24 * 60 * 60 * 1000,
          ).toISOString()
          rows = await fetchAllRows((from, to) => {
            const base = supabase.from('promo_offer_master').select('*')
            const filtered =
              dealsDateRange === '30days' ? base.gte('created_at', since) : base
            // Secondary sort on the primary key: created_at is not unique, and an
            // unstable sort would duplicate or skip rows across paged requests.
            return filtered
              .order('created_at', { ascending: false })
              .order('id', { ascending: true })
              .range(from, to)
          })
        } else if (key === 'businesses') {
          rows = await fetchAllRows((from, to) =>
            supabase
              .from('master_business_info')
              .select('*')
              .order('business_id', { ascending: true })
              .range(from, to),
          )
        } else {
          rows = await fetchAllRows((from, to) => {
            const base = supabase.from('profiles').select(USER_EXPORT_COLUMNS)
            const filtered =
              userFilter === 'verified'
                ? base.in('verification_status', VERIFIED_STATUSES)
                : base
            return filtered
              .order('created_at', { ascending: false })
              .order('id', { ascending: true })
              .range(from, to)
          })
        }

        if (rows.length === 0) {
          setExportNotes((prev) => ({
            ...prev,
            [key]: {
              tone: 'error',
              text: 'No records matched. Widen the filters and try again.',
            },
          }))
          return
        }

        const stamp = new Date().toISOString().slice(0, 10)
        const filename = `costfinders-${key}-${stamp}.${format}`

        if (format === 'json') {
          downloadFile(
            filename,
            JSON.stringify(rows, null, 2),
            'application/json',
          )
        } else {
          downloadFile(filename, toCsv(rows), 'text/csv')
        }

        setExportNotes((prev) => ({
          ...prev,
          [key]: {
            tone: 'success',
            text: `${rows.length.toLocaleString('en-US')} records exported to ${filename}`,
          },
        }))

        await logAdminAction('data_exported', 'export', key, {
          rows: rows.length,
          format,
        })
        loadActivityLog()
      } catch (error) {
        setExportNotes((prev) => ({
          ...prev,
          [key]: {
            tone: 'error',
            text: `Export failed: ${
              error instanceof Error ? error.message : 'Something went wrong.'
            } Try again.`,
          },
        }))
      } finally {
        setBusyExport(null)
      }
    },
    [dealsDateRange, formats, loadActivityLog, userFilter],
  )

  const filteredEntries = useMemo(() => {
    if (!entries) return []
    const active = activityFilters.find((f) => f.id === activityFilter)
    if (!active?.types) return entries
    const types: readonly string[] = active.types
    return entries.filter(
      (entry) => entry.target_type && types.includes(entry.target_type),
    )
  }, [entries, activityFilter])

  const setFormat = (key: ExportKey, format: ExportFormat) =>
    setFormats((prev) => ({ ...prev, [key]: format }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          Data management
        </h1>
        <p className="text-text-secondary mt-1">
          Download platform records and review what other admins have changed
        </p>
      </div>

      {/* Export Tools */}
      <div>
        <h2 className="font-display text-lg font-semibold text-text-primary mb-4 tracking-tight">
          Export tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Deals */}
          <Card variant="glass" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center">
                <FileArrowDown
                  size={20}
                  weight="fill"
                  className="text-text-secondary"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-text-primary">
                  Export deals
                </h3>
                <p className="text-sm text-text-secondary">
                  Every offer, with pricing
                </p>
              </div>
            </div>

            <FormatToggle
              name="deals"
              value={formats.deals}
              onChange={(format) => setFormat('deals', format)}
            />

            <div>
              <p className="text-sm text-text-secondary mb-1">Date range</p>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    { value: '30days', label: 'Last 30 days' },
                    { value: 'all', label: 'All time' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={dealsDateRange === option.value}
                    onClick={() => setDealsDateRange(option.value)}
                    className={`min-h-[44px] px-4 text-sm rounded-lg transition-colors ${
                      dealsDateRange === option.value
                        ? 'bg-text-primary text-white'
                        : 'bg-bg-surface text-text-secondary hover:bg-bg-elevated'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full mt-auto"
              isLoading={busyExport === 'deals'}
              disabled={busyExport !== null}
              onClick={() => runExport('deals')}
            >
              {busyExport === 'deals' ? 'Preparing...' : 'Export deals'}
            </Button>
            <ExportNoteLine note={exportNotes.deals} />
          </Card>

          {/* Businesses */}
          <Card variant="glass" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center">
                <Buildings
                  size={20}
                  weight="fill"
                  className="text-text-secondary"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-text-primary">
                  Export businesses
                </h3>
                <p className="text-sm text-text-secondary">
                  The full business directory
                </p>
              </div>
            </div>

            <FormatToggle
              name="businesses"
              value={formats.businesses}
              onChange={(format) => setFormat('businesses', format)}
            />

            <Button
              variant="primary"
              className="w-full mt-auto"
              isLoading={busyExport === 'businesses'}
              disabled={busyExport !== null}
              onClick={() => runExport('businesses')}
            >
              {busyExport === 'businesses'
                ? 'Preparing...'
                : 'Export businesses'}
            </Button>
            <ExportNoteLine note={exportNotes.businesses} />
          </Card>

          {/* Users */}
          <Card variant="glass" padding="lg" className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 shrink-0 rounded-xl bg-bg-surface flex items-center justify-center">
                <Users
                  size={20}
                  weight="fill"
                  className="text-text-secondary"
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-display font-semibold text-text-primary">
                  Export users
                </h3>
                <p className="text-sm text-text-secondary">
                  Consumer profile data
                </p>
              </div>
            </div>

            <FormatToggle
              name="users"
              value={formats.users}
              onChange={(format) => setFormat('users', format)}
            />

            <div>
              <label
                htmlFor="user-export-filter"
                className="text-sm text-text-secondary mb-1 block"
              >
                Include
              </label>
              <select
                id="user-export-filter"
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value as UserFilter)}
                className="w-full min-h-[44px] px-3 bg-bg-surface border border-border-default rounded-lg text-text-primary text-sm focus:outline-none focus:ring-2 focus:ring-border-accent"
              >
                <option value="all">All users</option>
                <option value="verified">Verified users only</option>
              </select>
            </div>

            <Button
              variant="primary"
              className="w-full mt-auto"
              isLoading={busyExport === 'users'}
              disabled={busyExport !== null}
              onClick={() => runExport('users')}
            >
              {busyExport === 'users' ? 'Preparing...' : 'Export users'}
            </Button>
            <ExportNoteLine note={exportNotes.users} />
          </Card>
        </div>
      </div>

      {/* Activity Log */}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary tracking-tight">
              Admin activity log
            </h2>
            <p className="text-sm text-text-secondary">
              The 50 most recent recorded admin actions
            </p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadActivityLog}
            disabled={logLoading}
            className="gap-1.5"
          >
            <ArrowClockwise size={16} />
            Refresh
          </Button>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {activityFilters.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={activityFilter === tab.id}
              onClick={() => setActivityFilter(tab.id)}
              className={`min-h-[44px] px-4 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activityFilter === tab.id
                  ? 'bg-text-primary text-white'
                  : 'bg-bg-surface text-text-secondary hover:bg-bg-elevated hover:text-text-primary'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {logLoading && (
          <Card variant="glass" padding="none">
            <div className="divide-y divide-border-default">
              {['a', 'b', 'c', 'd'].map((key) => (
                <div key={key} className="p-4 space-y-2">
                  <div className="h-3 w-24 rounded bg-bg-surface animate-pulse" />
                  <div className="h-4 w-56 max-w-full rounded bg-bg-surface animate-pulse" />
                </div>
              ))}
            </div>
          </Card>
        )}

        {!logLoading && logError && (
          <Card variant="glass" padding="lg" className="text-center">
            <Warning
              size={40}
              weight="light"
              className="text-text-secondary mx-auto mb-3"
            />
            <p className="font-medium text-text-primary">
              Couldn&apos;t load the activity log
            </p>
            <p className="text-sm text-text-secondary mt-1 mb-4">
              {logError} No actions were lost — they are still recorded.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={loadActivityLog}
              className="gap-1.5"
            >
              <ArrowClockwise size={16} />
              Try again
            </Button>
          </Card>
        )}

        {!(logLoading || logError) && entries?.length === 0 && (
          <Card variant="glass" padding="lg" className="text-center">
            <ClipboardText
              size={40}
              weight="light"
              className="text-text-secondary mx-auto mb-3"
            />
            <p className="font-medium text-text-primary">
              No admin actions yet
            </p>
            <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
              Deal approvals, account suspensions, claim decisions and content
              edits are recorded here as soon as they happen.
            </p>
          </Card>
        )}

        {!(logLoading || logError) &&
          (entries?.length ?? 0) > 0 &&
          filteredEntries.length === 0 && (
            <Card variant="glass" padding="lg" className="text-center">
              <p className="font-medium text-text-primary">
                No actions in this view
              </p>
              <p className="text-sm text-text-secondary mt-1 mb-4">
                Nothing recorded under this filter in the last 50 actions.
              </p>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActivityFilter('all')}
              >
                Show all actions
              </Button>
            </Card>
          )}

        {!(logLoading || logError) && filteredEntries.length > 0 && (
          <Card variant="glass" padding="none">
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border-default">
                    <th className="text-left p-4 text-sm font-semibold text-text-secondary">
                      When
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-text-secondary">
                      Admin
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-text-secondary">
                      Action
                    </th>
                    <th className="text-left p-4 text-sm font-semibold text-text-secondary">
                      Target
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-default">
                  {filteredEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="hover:bg-bg-elevated transition-colors"
                    >
                      <td className="p-4 text-sm text-text-muted whitespace-nowrap">
                        {formatTimestamp(entry.created_at)}
                      </td>
                      <td className="p-4 text-sm text-text-primary">
                        {entry.admin_email ?? 'Unknown admin'}
                      </td>
                      <td className="p-4 text-sm text-text-primary font-medium">
                        {humanize(entry.action)}
                      </td>
                      <td className="p-4 text-sm text-text-secondary">
                        {describeTarget(entry)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border-default">
              {filteredEntries.map((entry) => (
                <div key={entry.id} className="p-4">
                  <span className="text-xs text-text-muted">
                    {formatTimestamp(entry.created_at)}
                  </span>
                  <p className="text-sm font-medium text-text-primary mt-1">
                    {humanize(entry.action)}
                  </p>
                  <p className="text-xs text-text-secondary mt-0.5 break-words">
                    by {entry.admin_email ?? 'Unknown admin'}
                  </p>
                  <p className="text-sm text-text-secondary mt-2 pt-2 border-t border-border-default break-words">
                    {describeTarget(entry)}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
