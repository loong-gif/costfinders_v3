'use client'

import {
  ArrowClockwise,
  ArrowCounterClockwise,
  ArrowSquareOut,
  CalendarPlus,
  CheckCircle,
  Clock,
  Envelope,
  FacebookLogo,
  Globe,
  Hourglass,
  InstagramLogo,
  MapPin,
  Phone,
  UserCircle,
  Warning,
  Wrench,
  XCircle,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import {
  closeLeadAction,
  extendLeadAction,
  getRelayedLeadsAction,
  getUnrelayedLeadsAction,
  type LeadRow,
  markLeadRelayedAction,
  type RelayMethod,
  type RelayOutcome,
  reopenLeadAction,
  undoLeadRelayAction,
} from '@/lib/actions/admin-leads'
import {
  displayWebsite,
  mapsUrlForAddress,
  telHref,
  websiteHref,
} from '@/lib/utils/contactLinks'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import { formatPhone } from '@/lib/utils/phone'

// getRelayedLeadsAction caps its query at 50 rows, so the history and its count
// describe the most recent 50 — never call it a lifetime total.
const RELAYED_HISTORY_LIMIT = 50

const HOUR_MS = 1000 * 60 * 60

/** A lead this close to its deadline is flagged. */
const URGENT_HOURS = 48

interface Feedback {
  tone: 'success' | 'warning' | 'error'
  text: string
}

interface ActionOutcome {
  success: boolean
  error?: string
  warning?: string
}

/** A timestamp (expires_at, relayed_at). Date-only columns go through formatDateOnly. */
function formatDate(dateStr: string | null, fallback = '—'): string {
  if (!dateStr) return fallback
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / HOUR_MS)
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60))
    return mins <= 1 ? 'just now' : `${mins}m ago`
  }
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

interface ExpiryInfo {
  expired: boolean
  urgent: boolean
  label: string
  detail: string
}

/**
 * Derived from `claims.expires_at`, the relay deadline this screen works against. Past it the
 * claim leaves the pending queue; "Extend 7 days" moves it. The customer keeps the clinic's
 * details either way.
 */
function expiryInfo(expiresAt: string): ExpiryInfo {
  const msLeft = new Date(expiresAt).getTime() - Date.now()
  const detail = `Expires ${formatDate(expiresAt)}`

  if (msLeft <= 0) {
    return {
      expired: true,
      urgent: true,
      label: 'Expired',
      detail: `Expired ${formatDate(expiresAt)}`,
    }
  }

  const hoursLeft = Math.floor(msLeft / HOUR_MS)
  if (hoursLeft < URGENT_HOURS) {
    return {
      expired: false,
      urgent: true,
      label: hoursLeft < 1 ? 'Under an hour left' : `${hoursLeft}h left`,
      detail,
    }
  }

  const daysLeft = Math.floor(hoursLeft / 24)
  return {
    expired: false,
    urgent: false,
    label: daysLeft === 1 ? '1 day left' : `${daysLeft} days left`,
    detail,
  }
}

/** claims.status in words. `pending` is the only status that belongs in the queue. */
const STATUS_LABEL: Record<
  string,
  { label: string; variant: 'default' | 'info' | 'success' | 'error' }
> = {
  pending: { label: 'Waiting', variant: 'info' },
  contacted: { label: 'Clinic contacted them', variant: 'success' },
  booked: { label: 'Booked', variant: 'success' },
  completed: { label: 'Completed', variant: 'success' },
  cancelled: { label: 'Cancelled by customer', variant: 'default' },
  expired: { label: 'Expired', variant: 'error' },
  // Not a claims.status: ClosedLeadRow's badge for a pending claim an admin closed.
  closed: { label: 'Closed', variant: 'default' },
}

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_LABEL[status] ?? {
    label: status,
    variant: 'default' as const,
  }
  return (
    <Badge variant={config.variant} size="sm">
      {config.label}
    </Badge>
  )
}

const relayMethodConfig: Record<
  RelayMethod,
  { label: string; icon: typeof Envelope }
> = {
  email: { label: 'Email', icon: Envelope },
  website: { label: 'Website', icon: Globe },
  facebook: { label: 'Facebook', icon: FacebookLogo },
  instagram: { label: 'Instagram', icon: InstagramLogo },
  phone: { label: 'Phone', icon: Phone },
  manual: { label: 'Other', icon: Wrench },
}

/** Mirrors RELAY_OUTCOMES in admin-leads.ts; the server re-validates. */
const outcomeConfig: Record<RelayOutcome, { label: string; notify: boolean }> =
  {
    reached_clinic: { label: 'Reached the clinic', notify: true },
    left_voicemail: { label: 'Left a voicemail or message', notify: true },
    no_answer: { label: 'No answer', notify: false },
    clinic_declined: { label: 'Clinic declined', notify: false },
    other: { label: 'Other', notify: true },
  }

function isRelayMethod(value: string | null): value is RelayMethod {
  return value !== null && value in relayMethodConfig
}

function isRelayOutcome(value: string | null): value is RelayOutcome {
  return value !== null && value in outcomeConfig
}

/**
 * Only offer a channel the operator can actually use on this lead. Phone and Other are always
 * available: a business phone is on file for most businesses, and for the rest a call is still
 * something the operator arranges off-platform and then records here.
 */
function availableMethods(lead: LeadRow): RelayMethod[] {
  const methods: RelayMethod[] = []
  if (lead.owner_email) methods.push('email')
  if (lead.business_website) methods.push('website')
  if (lead.business_facebook_url) methods.push('facebook')
  if (lead.business_instagram_url) methods.push('instagram')
  methods.push('phone', 'manual')
  return methods
}

/**
 * Social profile links. Not websiteHref(): that strips the query string, and a Facebook
 * `profile.php?id=` link is nothing without it.
 */
function socialHref(url: string): string {
  return url.startsWith('http') ? url : `https://${url}`
}

function stripScheme(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

interface MetricCardProps {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  value: number
  label: string
  caption?: string
  isLoading?: boolean
}

function MetricCard({
  icon: Icon,
  value,
  label,
  caption,
  isLoading,
}: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div className="w-12 h-12 shrink-0 rounded-xl flex items-center justify-center bg-accent-muted">
        <Icon size={24} weight="fill" className="text-text-secondary" />
      </div>
      <div>
        {isLoading ? (
          <div className="h-7 w-12 rounded-lg bg-bg-surface animate-pulse" />
        ) : (
          <p className="text-2xl font-bold text-text-primary">{value}</p>
        )}
        <p className="text-sm text-text-secondary">{label}</p>
        {caption && <p className="text-xs text-text-muted">{caption}</p>}
      </div>
    </Card>
  )
}

function ContactLink({
  icon: Icon,
  label,
  href,
  value,
  external,
}: {
  icon: typeof Envelope
  label: string
  href: string
  value: string
  external?: boolean
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="text-text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <a
          href={href}
          {...(external
            ? { target: '_blank', rel: 'noopener noreferrer' }
            : {})}
          className="text-sm text-accent hover:text-accent-hover transition-colors break-all inline-flex items-center gap-1"
        >
          {value}
          {external && <ArrowSquareOut size={12} className="shrink-0" />}
        </a>
      </div>
    </div>
  )
}

function ContactFact({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Envelope
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon size={16} className="text-text-muted mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-text-muted">{label}</p>
        <p className="text-sm text-text-primary break-words">{value}</p>
      </div>
    </div>
  )
}

/**
 * The handles an operator has for the business. `master_business_info` stores no email; the one
 * address that can appear is the owner's account address, which exists only for a claimed
 * listing. A wrong phone or website is fixed on the Businesses screen ("Edit contact details").
 */
function BusinessContact({ lead }: { lead: LeadRow }) {
  const phoneLink = telHref(lead.business_phone)
  const siteLink = websiteHref(lead.business_website)
  const siteLabel = displayWebsite(lead.business_website)
  const mapLink = lead.business_google_place_id
    ? `https://www.google.com/maps/place/?q=place_id:${lead.business_google_place_id}`
    : mapsUrlForAddress(lead.business_address, lead.business_city)
  const hasAnyHandle = Boolean(
    lead.owner_email ||
      phoneLink ||
      siteLink ||
      lead.business_facebook_url ||
      lead.business_instagram_url ||
      lead.business_address,
  )

  return (
    <div className="rounded-xl bg-bg-elevated p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        Reach the business
      </p>

      {lead.owner_email && (
        <ContactLink
          icon={Envelope}
          label={
            lead.owner_name
              ? `Owner account — ${lead.owner_name}`
              : 'Owner account'
          }
          href={`mailto:${lead.owner_email}`}
          value={lead.owner_email}
        />
      )}

      {/* Above the website on purpose: a phone call is the shortest path to a clinic. */}
      {lead.business_phone && phoneLink && (
        <ContactLink
          icon={Phone}
          label="Business phone"
          href={phoneLink}
          value={formatPhone(lead.business_phone)}
        />
      )}

      {siteLink && siteLabel && (
        <ContactLink
          icon={Globe}
          label="Website"
          href={siteLink}
          value={siteLabel}
          external
        />
      )}

      {lead.business_facebook_url && (
        <ContactLink
          icon={FacebookLogo}
          label="Facebook"
          href={socialHref(lead.business_facebook_url)}
          value={stripScheme(lead.business_facebook_url)}
          external
        />
      )}

      {lead.business_instagram_url && (
        <ContactLink
          icon={InstagramLogo}
          label="Instagram"
          href={socialHref(lead.business_instagram_url)}
          value={stripScheme(lead.business_instagram_url)}
          external
        />
      )}

      {lead.business_address &&
        (mapLink ? (
          <ContactLink
            icon={MapPin}
            label="Address"
            href={mapLink}
            value={lead.business_address}
            external
          />
        ) : (
          <ContactFact
            icon={MapPin}
            label="Address"
            value={lead.business_address}
          />
        ))}

      {hasAnyHandle ? (
        <p className="text-xs text-text-secondary pt-1 border-t border-border-default">
          {lead.owner_email
            ? 'We store no email for a business itself. The address above belongs to the owner account that claimed this listing.'
            : phoneLink
              ? 'No one has claimed this listing, so there is no owner email. The phone number above is the clinic’s own.'
              : 'No one has claimed this listing, and we have no phone on file for it. The website or a social profile is the way in.'}
        </p>
      ) : (
        <p className="text-sm text-text-secondary">
          Nothing is on file for this business: no website, no social profile,
          no address. Look it up before you record a relay.
        </p>
      )}
    </div>
  )
}

/** What the operator passes on, and how to get back to the person who asked. */
function ConsumerContact({ lead }: { lead: LeadRow }) {
  const phoneLink = telHref(lead.consumer_phone)
  return (
    <div className="rounded-xl bg-bg-elevated p-3 space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
        The customer
      </p>

      <ContactFact
        icon={UserCircle}
        label="Name"
        value={lead.consumer_name ?? 'Not provided'}
      />

      {lead.consumer_email ? (
        <ContactLink
          icon={Envelope}
          label="Email"
          href={`mailto:${lead.consumer_email}`}
          value={lead.consumer_email}
        />
      ) : (
        <ContactFact icon={Envelope} label="Email" value="Not provided" />
      )}

      {lead.consumer_phone && phoneLink ? (
        <ContactLink
          icon={Phone}
          label="Phone"
          href={phoneLink}
          value={formatPhone(lead.consumer_phone)}
        />
      ) : (
        <ContactFact icon={Phone} label="Phone" value="Not provided" />
      )}

      <ContactFact
        icon={Clock}
        label="Asked for"
        value={
          lead.preferred_date || lead.preferred_time
            ? `${lead.preferred_date ? formatDateOnly(lead.preferred_date) : 'Any date'} at ${lead.preferred_time || 'any time'}`
            : 'No date or time preference'
        }
      />
    </div>
  )
}

/** The "Mark relayed" form: channel, outcome, note, and whether to email the customer. */
function RelayForm({
  lead,
  busy,
  onSubmit,
  onCancel,
}: {
  lead: LeadRow
  busy: boolean
  onSubmit: (input: {
    method: RelayMethod
    outcome: RelayOutcome
    note: string
    notifyCustomer: boolean
  }) => void
  onCancel: () => void
}) {
  const [method, setMethod] = useState<RelayMethod | null>(null)
  const [outcome, setOutcome] = useState<RelayOutcome>('reached_clinic')
  const [note, setNote] = useState('')
  const [notify, setNotify] = useState(false)
  const canNotify =
    outcomeConfig[outcome].notify && Boolean(lead.consumer_email)

  return (
    <div className="rounded-xl border border-border-default p-3 space-y-3">
      <div>
        <p className="text-sm font-medium text-text-primary mb-2">
          How did you send it?
        </p>
        <div className="flex flex-wrap gap-2">
          {availableMethods(lead).map((option) => {
            const config = relayMethodConfig[option]
            const MethodIcon = config.icon
            return (
              <Button
                key={option}
                variant={method === option ? 'primary' : 'secondary'}
                size="sm"
                aria-pressed={method === option}
                onClick={() => setMethod(option)}
                disabled={busy}
                className="gap-1.5"
              >
                <MethodIcon size={14} />
                {config.label}
              </Button>
            )
          })}
        </div>
      </div>

      <Select
        label="What happened"
        value={outcome}
        onChange={(e) => setOutcome(e.target.value as RelayOutcome)}
        disabled={busy}
      >
        {(Object.keys(outcomeConfig) as RelayOutcome[]).map((value) => (
          <option key={value} value={value}>
            {outcomeConfig[value].label}
          </option>
        ))}
      </Select>

      <Textarea
        label="Note (optional)"
        placeholder="Who you spoke to, what they said"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={1000}
        rows={2}
        disabled={busy}
      />

      <label className="flex items-start gap-2 text-sm text-text-primary">
        <input
          type="checkbox"
          checked={notify && canNotify}
          onChange={(e) => setNotify(e.target.checked)}
          disabled={busy || !canNotify}
          className="mt-0.5 h-4 w-4 accent-accent"
        />
        <span>
          Tell the customer we passed this on
          <span className="block text-xs text-text-secondary">
            {!lead.consumer_email
              ? 'No email address on file for this customer.'
              : outcomeConfig[outcome].notify
                ? `Emails ${lead.consumer_email} with the clinic's phone and website.`
                : `Not available for "${outcomeConfig[outcome].label}": the email says we passed it on.`}
          </span>
        </span>
      </label>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          size="sm"
          disabled={busy || method === null}
          isLoading={busy}
          onClick={() =>
            method &&
            onSubmit({
              method,
              outcome,
              note,
              notifyCustomer: notify && canNotify,
            })
          }
        >
          Save relay
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        {method === null && (
          <span className="text-xs text-text-muted self-center">
            Pick how you sent it first.
          </span>
        )}
      </div>
    </div>
  )
}

function CloseForm({
  busy,
  onSubmit,
  onCancel,
}: {
  busy: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
}) {
  const [reason, setReason] = useState('')
  return (
    <div className="rounded-xl border border-border-default p-3 space-y-3">
      <Textarea
        label="Why are you closing it without relaying?"
        placeholder="Duplicate claim, customer asked us to stop, test claim..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={1000}
        rows={2}
        disabled={busy}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="danger"
          size="sm"
          disabled={busy || reason.trim() === ''}
          isLoading={busy}
          onClick={() => onSubmit(reason)}
        >
          Close lead
        </Button>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

type CardMode = 'idle' | 'relay' | 'close'

interface LeadHandlers {
  onRelay: (
    lead: LeadRow,
    input: {
      method: RelayMethod
      outcome: RelayOutcome
      note: string
      notifyCustomer: boolean
    },
  ) => Promise<boolean>
  onClose: (lead: LeadRow, reason: string) => Promise<boolean>
  onExtend: (lead: LeadRow) => Promise<boolean>
  onReopen: (lead: LeadRow) => Promise<boolean>
  onUndoRelay: (lead: LeadRow) => Promise<boolean>
  busyId: string | null
}

function LeadCard({
  lead,
  handlers,
}: {
  lead: LeadRow
  handlers: LeadHandlers
}) {
  const [mode, setMode] = useState<CardMode>('idle')
  const busy = handlers.busyId === lead.id
  const expiry = expiryInfo(lead.expires_at)

  return (
    <Card
      variant="glass"
      padding="md"
      className={`space-y-3 ${expiry.urgent ? 'ring-1 ring-border-accent' : ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-text-primary truncate">
              {lead.deal_title || `Deal #${lead.deal_id}`}
            </p>
            <StatusBadge status={lead.status} />
            <Badge
              variant={
                expiry.expired ? 'error' : expiry.urgent ? 'warning' : 'default'
              }
              size="sm"
              className="gap-1"
            >
              <Hourglass size={12} />
              {expiry.label}
            </Badge>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            {lead.business_name || `Business #${lead.business_id}`}
            {lead.business_city ? ` — ${lead.business_city}` : ''}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-text-muted whitespace-nowrap">
            Filed {timeAgo(lead.created_at)}
          </p>
          <p className="text-xs text-text-muted whitespace-nowrap">
            {expiry.detail}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <BusinessContact lead={lead} />
        <ConsumerContact lead={lead} />
      </div>

      {lead.notes && (
        <div>
          <p className="text-xs text-text-muted mb-1">What they wrote</p>
          <p className="text-sm text-text-secondary bg-bg-elevated rounded-lg px-3 py-2">
            {lead.notes}
          </p>
        </div>
      )}

      {mode === 'relay' && (
        <RelayForm
          lead={lead}
          busy={busy}
          onCancel={() => setMode('idle')}
          onSubmit={async (input) => {
            if (await handlers.onRelay(lead, input)) setMode('idle')
          }}
        />
      )}

      {mode === 'close' && (
        <CloseForm
          busy={busy}
          onCancel={() => setMode('idle')}
          onSubmit={async (reason) => {
            if (await handlers.onClose(lead, reason)) setMode('idle')
          }}
        />
      )}

      {mode === 'idle' && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setMode('relay')}
            disabled={busy}
          >
            Mark relayed
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlers.onExtend(lead)}
            disabled={busy}
            isLoading={busy}
            className="gap-1.5"
            title="Give this lead 7 more days before it expires from the queue"
          >
            <CalendarPlus size={14} />
            Extend 7 days
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setMode('close')}
            disabled={busy}
            className="gap-1.5"
          >
            <XCircle size={14} />
            Close without relaying
          </Button>
          <span className="text-xs text-text-muted font-mono ml-auto">
            {lead.id.slice(0, 8)}
          </span>
        </div>
      )}
    </Card>
  )
}

/** An unrelayed lead that has left the queue, with the reason and the one way back in. */
function ClosedLeadRow({
  lead,
  handlers,
}: {
  lead: LeadRow
  handlers: LeadHandlers
}) {
  const busy = handlers.busyId === lead.id
  const expired =
    lead.status === 'expired' ||
    (lead.status === 'pending' &&
      !lead.admin_closed_at &&
      expiryInfo(lead.expires_at).expired)

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-b border-border-default last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-text-primary truncate">
            {lead.deal_title || `Deal #${lead.deal_id}`}
          </p>
          {/* A closed row's claim is often still `pending`, which badged "Waiting" beside
              "Expired Sep 23". Badge what closed it. */}
          <StatusBadge
            status={
              expired
                ? 'expired'
                : lead.admin_closed_at
                  ? 'closed'
                  : lead.status
            }
          />
        </div>
        <p className="text-xs text-text-secondary truncate">
          {lead.business_name || `Business #${lead.business_id}`}
          {' — '}
          {lead.consumer_name ??
            lead.consumer_email ??
            lead.consumer_id.slice(0, 8)}
        </p>
        <p className="text-xs text-text-muted mt-0.5">
          {lead.closed_reason}
          {expired ? ` ${formatDate(lead.expires_at)}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
        {lead.admin_closed_at && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlers.onReopen(lead)}
            disabled={busy}
            isLoading={busy}
          >
            Reopen
          </Button>
        )}
        {expired && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handlers.onExtend(lead)}
            disabled={busy}
            isLoading={busy}
            className="gap-1.5"
            title="Give this lead 7 more days before it expires from the queue"
          >
            <CalendarPlus size={14} />
            Extend 7 days
          </Button>
        )}
      </div>
    </div>
  )
}

function RelayedLeadRow({
  lead,
  handlers,
}: {
  lead: LeadRow
  handlers: LeadHandlers
}) {
  const [confirmUndo, setConfirmUndo] = useState(false)
  const busy = handlers.busyId === lead.id
  const method = lead.relay_method
  const config = isRelayMethod(method) ? relayMethodConfig[method] : null
  const MethodIcon = config?.icon
  const outcome = isRelayOutcome(lead.relay_outcome)
    ? outcomeConfig[lead.relay_outcome].label
    : null

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-b border-border-default last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-success-bg flex items-center justify-center flex-shrink-0">
        <CheckCircle size={16} weight="fill" className="text-success" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-text-primary truncate">
          {lead.deal_title || `Deal #${lead.deal_id}`}
        </p>
        <p className="text-xs text-text-secondary truncate">
          {lead.business_name || `Business #${lead.business_id}`}
          {' — '}
          {lead.consumer_email ??
            lead.consumer_name ??
            lead.consumer_id.slice(0, 8)}
        </p>
        {(outcome || lead.relay_note) && (
          <p className="text-xs text-text-muted mt-0.5 break-words">
            {outcome}
            {outcome && lead.relay_note ? ': ' : ''}
            {lead.relay_note}
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 flex-shrink-0 ml-auto">
        {/* A relayed claim stays `pending` until the clinic acts; "Waiting" beside the relay
            badge read as though it had not been passed on. */}
        {lead.status !== 'pending' && <StatusBadge status={lead.status} />}
        {MethodIcon && config && (
          <Badge variant="success" size="sm" className="gap-1">
            <MethodIcon size={12} />
            {config.label}
          </Badge>
        )}
        <span className="text-xs text-text-muted">
          {formatDate(lead.relayed_at)}
        </span>
        {confirmUndo ? (
          <>
            <Button
              variant="danger"
              size="sm"
              onClick={async () => {
                if (await handlers.onUndoRelay(lead)) setConfirmUndo(false)
              }}
              disabled={busy}
              isLoading={busy}
            >
              Undo relay
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setConfirmUndo(false)}
              disabled={busy}
            >
              Keep
            </Button>
          </>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setConfirmUndo(true)}
            className="gap-1"
          >
            <ArrowCounterClockwise size={14} />
            Undo
          </Button>
        )}
      </div>
    </div>
  )
}

function QueueSkeleton() {
  return (
    <div className="space-y-3">
      {['a', 'b'].map((key) => (
        <Card key={key} variant="glass" padding="md" className="space-y-3">
          <div className="h-5 w-48 max-w-full rounded bg-bg-surface animate-pulse" />
          <div className="h-3 w-32 max-w-full rounded bg-bg-surface animate-pulse" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {['w', 'x'].map((cell) => (
              <div
                key={cell}
                className="h-28 rounded-xl bg-bg-surface animate-pulse"
              />
            ))}
          </div>
        </Card>
      ))}
    </div>
  )
}

const FEEDBACK_STYLE: Record<Feedback['tone'], string> = {
  success: 'bg-success-bg border border-success/20 text-success',
  warning: 'bg-warning/10 border border-warning/20 text-warning',
  error: 'bg-error-bg border border-error/20 text-error',
}

export default function LeadRelayDashboard() {
  const [pendingLeads, setPendingLeads] = useState<LeadRow[]>([])
  const [closedLeads, setClosedLeads] = useState<LeadRow[]>([])
  const [relayedLeads, setRelayedLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    setLoadError(null)

    const [unrelayedResult, relayedResult] = await Promise.all([
      getUnrelayedLeadsAction(),
      getRelayedLeadsAction(),
    ])

    // A failed read used to fall through to an empty queue, which rendered the
    // green "All caught up" card — the most dangerous possible lie on this screen.
    if (!(unrelayedResult.success && relayedResult.success)) {
      setPendingLeads([])
      setClosedLeads([])
      setRelayedLeads([])
      setLoadError(
        unrelayedResult.error ?? relayedResult.error ?? 'Something went wrong.',
      )
      setLoading(false)
      return
    }

    setPendingLeads(unrelayedResult.pending ?? [])
    setClosedLeads(unrelayedResult.closed ?? [])
    setRelayedLeads(relayedResult.leads ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const showFeedback = useCallback((next: Feedback) => {
    setFeedback(next)
    // Warnings and errors carry something the admin has to act on, so they stay longer.
    setTimeout(() => setFeedback(null), next.tone === 'success' ? 5000 : 12000)
  }, [])

  /** Run one lead action, report it, reload the lists. Resolves true on success. */
  const runAction = useCallback(
    async (
      lead: LeadRow,
      action: () => Promise<ActionOutcome>,
      successText: string,
      failurePrefix: string,
    ): Promise<boolean> => {
      setBusyId(lead.id)
      const result = await action()
      setBusyId(null)

      if (!result.success) {
        showFeedback({
          tone: 'error',
          text: `${failurePrefix} ${result.error ?? 'Please try again.'}`,
        })
        return false
      }
      showFeedback(
        result.warning
          ? { tone: 'warning', text: `${successText} ${result.warning}` }
          : { tone: 'success', text: successText },
      )
      await loadLeads()
      return true
    },
    [loadLeads, showFeedback],
  )

  const handlers: LeadHandlers = useMemo(
    () => ({
      busyId,
      onRelay: (lead, input) =>
        runAction(
          lead,
          () => markLeadRelayedAction(lead.id, input),
          `Relay recorded: sent by ${relayMethodConfig[input.method].label.toLowerCase()}, ${outcomeConfig[input.outcome].label.toLowerCase()}.${input.notifyCustomer ? ' The customer was emailed.' : ''}`,
          "Couldn't record the relay.",
        ),
      onClose: (lead, reason) =>
        runAction(
          lead,
          () => closeLeadAction(lead.id, reason),
          'Lead closed. It is in the closed list below if you need it back.',
          "Couldn't close that lead.",
        ),
      onExtend: (lead) =>
        runAction(
          lead,
          () => extendLeadAction(lead.id),
          'This lead has 7 more days before it expires from the queue.',
          "Couldn't extend that lead.",
        ),
      onReopen: (lead) =>
        runAction(
          lead,
          () => reopenLeadAction(lead.id),
          'Lead reopened and back in the queue.',
          "Couldn't reopen that lead.",
        ),
      onUndoRelay: (lead) =>
        runAction(
          lead,
          () => undoLeadRelayAction(lead.id),
          'Relay undone. The lead is back in the queue.',
          "Couldn't undo that relay.",
        ),
    }),
    [busyId, runAction],
  )

  const stats = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    return {
      pending: pendingLeads.length,
      urgent: pendingLeads.filter((l) => expiryInfo(l.expires_at).urgent)
        .length,
      relayedToday: relayedLeads.filter(
        (l) => l.relayed_at && new Date(l.relayed_at) >= todayStart,
      ).length,
      relayedRecently: relayedLeads.length,
    }
  }, [pendingLeads, relayedLeads])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Lead relay
          </h1>
          <p className="text-text-secondary mt-1">
            Pass each customer claim to the clinic, then record how it went.
            Each claim runs out seven days after it was filed.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={loadLeads}
          disabled={loading}
          className="gap-1.5"
        >
          <ArrowClockwise size={16} />
          Refresh
        </Button>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          role={feedback.tone === 'success' ? 'status' : 'alert'}
          className={`px-4 py-3 rounded-xl text-sm font-medium ${FEEDBACK_STYLE[feedback.tone]}`}
        >
          {feedback.text}
        </div>
      )}

      {/* Load failure — shown instead of stats, which would otherwise read as zeros */}
      {!loading && loadError ? (
        <Card variant="glass" padding="lg" className="text-center">
          <Warning
            size={40}
            weight="light"
            className="text-text-secondary mx-auto mb-3"
          />
          <p className="font-medium text-text-primary">
            Couldn&apos;t load the lead queue
          </p>
          <p className="text-sm text-text-secondary mt-1 mb-4 max-w-md mx-auto">
            {loadError} Leads are safe. None have been lost, and none have been
            marked relayed. Load the queue again to work through it.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={loadLeads}
            className="gap-1.5"
          >
            <ArrowClockwise size={16} />
            Try again
          </Button>
        </Card>
      ) : (
        <>
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={Clock}
              value={stats.pending}
              label="Waiting to be relayed"
              isLoading={loading}
            />
            <MetricCard
              icon={Hourglass}
              value={stats.urgent}
              label={`Due within ${URGENT_HOURS}h`}
              isLoading={loading}
            />
            <MetricCard
              icon={CheckCircle}
              value={stats.relayedToday}
              label="Relayed today"
              isLoading={loading}
            />
            <MetricCard
              icon={UserCircle}
              value={stats.relayedRecently}
              label="Relayed recently"
              caption={`Last ${RELAYED_HISTORY_LIMIT} records`}
              isLoading={loading}
            />
          </div>

          {/* Pending Queue */}
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary mb-3 tracking-tight">
              Pending queue
              {!loading && pendingLeads.length > 0 && (
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({pendingLeads.length}, closest deadline first)
                </span>
              )}
            </h2>

            {loading && <QueueSkeleton />}

            {!loading && pendingLeads.length === 0 && (
              <Card variant="glass" padding="lg" className="text-center">
                <CheckCircle
                  size={40}
                  weight="light"
                  className="text-success mx-auto mb-2"
                />
                <p className="text-text-primary font-medium">All caught up</p>
                <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
                  No claim is waiting to be relayed. A new claim lands here the
                  moment a customer makes it, and it is also emailed to the ops
                  inbox.
                </p>
              </Card>
            )}

            {!loading && pendingLeads.length > 0 && (
              <div className="space-y-3">
                {pendingLeads.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} handlers={handlers} />
                ))}
              </div>
            )}
          </div>

          {/* Relayed History */}
          <div>
            <h2 className="font-display text-lg font-semibold text-text-primary mb-3 tracking-tight">
              Recently relayed
              {!loading && relayedLeads.length > 0 && (
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({relayedLeads.length})
                </span>
              )}
            </h2>

            {loading && (
              <Card variant="glass" padding="md">
                <div className="h-12 rounded bg-bg-surface animate-pulse" />
              </Card>
            )}

            {!loading && relayedLeads.length === 0 && (
              <Card variant="glass" padding="lg" className="text-center">
                <UserCircle
                  size={40}
                  weight="light"
                  className="text-text-secondary mx-auto mb-2"
                />
                <p className="text-text-primary font-medium">
                  No relayed leads yet
                </p>
                <p className="text-sm text-text-secondary mt-1 max-w-md mx-auto">
                  Once you mark a lead as relayed, it moves here with how you
                  sent it and what happened.
                </p>
              </Card>
            )}

            {!loading && relayedLeads.length > 0 && (
              <Card variant="glass" padding="md">
                {relayedLeads.map((lead) => (
                  <RelayedLeadRow
                    key={lead.id}
                    lead={lead}
                    handlers={handlers}
                  />
                ))}
              </Card>
            )}
          </div>

          {/* Closed without a relay */}
          {!loading && closedLeads.length > 0 && (
            <div>
              <h2 className="font-display text-lg font-semibold text-text-primary mb-1 tracking-tight">
                Closed
                <span className="ml-2 text-sm font-normal text-text-muted">
                  ({closedLeads.length})
                </span>
              </h2>
              <p className="text-sm text-text-secondary mb-3">
                Claims that left the queue without a relay: cancelled, expired,
                handled by the clinic, or closed by an admin.
              </p>
              <Card variant="glass" padding="md">
                {closedLeads.map((lead) => (
                  <ClosedLeadRow
                    key={lead.id}
                    lead={lead}
                    handlers={handlers}
                  />
                ))}
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  )
}
