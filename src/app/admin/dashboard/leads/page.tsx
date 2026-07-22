'use client'

import {
  ArrowClockwise,
  CheckCircle,
  Clock,
  Envelope,
  Phone,
  Spinner,
  UserCircle,
  Wrench,
} from '@phosphor-icons/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  getRelayedLeadsAction,
  getUnrelayedLeadsAction,
  markLeadRelayedAction,
} from '@/lib/actions/admin-leads'

type RelayMethod = 'email' | 'phone' | 'manual'

interface LeadRow {
  id: string
  consumer_id: string
  deal_id: number
  business_id: number
  status: string
  preferred_date: string | null
  preferred_time: string | null
  notes: string | null
  relayed_at: string | null
  relayed_by: string | null
  relay_method: string | null
  created_at: string
  consumer_email?: string
  deal_title?: string
  business_name?: string
  business_city?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--'
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function _formatTime(dateStr: string | null): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 1) {
    const mins = Math.floor(diff / (1000 * 60))
    return mins <= 1 ? 'just now' : `${mins}m ago`
  }
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

const relayMethodConfig: Record<
  RelayMethod,
  { label: string; icon: typeof Envelope }
> = {
  email: { label: 'Email', icon: Envelope },
  phone: { label: 'Phone', icon: Phone },
  manual: { label: 'Manual', icon: Wrench },
}

interface MetricCardProps {
  icon: React.ComponentType<{
    size?: number
    weight?: 'light' | 'fill'
    className?: string
  }>
  value: string | number
  label: string
  highlight?: boolean
}

function MetricCard({ icon: Icon, value, label, highlight }: MetricCardProps) {
  return (
    <Card variant="glass" padding="md" className="flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center ${
          highlight ? 'bg-amber-800/8' : 'bg-amber-800/8'
        }`}
      >
        <Icon
          size={24}
          weight="fill"
          className={highlight ? 'text-amber-800' : 'text-amber-800'}
        />
      </div>
      <div>
        <p className="text-2xl font-bold text-[#451a03]">{value}</p>
        <p className="text-sm text-[#78350f]">{label}</p>
      </div>
    </Card>
  )
}

function LeadCard({
  lead,
  onRelay,
  relaying,
}: {
  lead: LeadRow
  onRelay: (id: string, method: RelayMethod) => void
  relaying: string | null
}) {
  const [showMethods, setShowMethods] = useState(false)
  const isRelaying = relaying === lead.id

  return (
    <Card variant="glass" padding="md" className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-[#451a03] truncate">
              {lead.deal_title || `Deal #${lead.deal_id}`}
            </p>
            <Badge variant="warning" size="sm">
              Pending
            </Badge>
          </div>
          <p className="text-sm text-[#78350f] mt-0.5">
            {lead.business_name || `Business #${lead.business_id}`}
            {lead.business_city ? ` — ${lead.business_city}` : ''}
          </p>
        </div>
        <p className="text-xs text-[#92400e] whitespace-nowrap">
          {timeAgo(lead.created_at)}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
        <div>
          <p className="text-xs text-[#92400e]">Claim ID</p>
          <p className="text-[#451a03] font-mono text-xs truncate">
            {lead.id.slice(0, 8)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#92400e]">Consumer</p>
          <p className="text-[#451a03] truncate">
            {lead.consumer_email || lead.consumer_id.slice(0, 8)}
          </p>
        </div>
        <div>
          <p className="text-xs text-[#92400e]">Preferred Date</p>
          <p className="text-[#451a03]">{formatDate(lead.preferred_date)}</p>
        </div>
        <div>
          <p className="text-xs text-[#92400e]">Preferred Time</p>
          <p className="text-[#451a03]">{lead.preferred_time || '--'}</p>
        </div>
      </div>

      {lead.notes && (
        <p className="text-sm text-[#78350f] bg-[#faf5ee] rounded-lg px-3 py-2">
          {lead.notes}
        </p>
      )}

      <div className="flex items-center gap-2 pt-1">
        {!showMethods ? (
          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowMethods(true)}
            disabled={isRelaying}
            isLoading={isRelaying}
          >
            Mark Relayed
          </Button>
        ) : (
          <>
            <span className="text-xs text-[#92400e] mr-1">Via:</span>
            {(
              Object.entries(relayMethodConfig) as [
                RelayMethod,
                typeof relayMethodConfig.email,
              ][]
            ).map(([method, config]) => {
              const MethodIcon = config.icon
              return (
                <Button
                  key={method}
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    onRelay(lead.id, method)
                    setShowMethods(false)
                  }}
                  disabled={isRelaying}
                  className="gap-1.5"
                >
                  <MethodIcon size={14} />
                  {config.label}
                </Button>
              )
            })}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowMethods(false)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </Card>
  )
}

function RelayedLeadRow({ lead }: { lead: LeadRow }) {
  const method = lead.relay_method as RelayMethod | null
  const config = method ? relayMethodConfig[method] : null
  const MethodIcon = config?.icon

  return (
    <div className="flex items-center gap-4 py-3 border-b border-[#d4c4b0] last:border-b-0">
      <div className="w-8 h-8 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
        <CheckCircle size={16} weight="fill" className="text-emerald-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-[#451a03] truncate">
          {lead.deal_title || `Deal #${lead.deal_id}`}
        </p>
        <p className="text-xs text-[#78350f]">
          {lead.business_name || `Business #${lead.business_id}`}
          {' — '}
          {lead.consumer_email || lead.consumer_id.slice(0, 8)}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {MethodIcon && config && (
          <Badge variant="success" size="sm" className="gap-1">
            <MethodIcon size={12} />
            {config.label}
          </Badge>
        )}
        <span className="text-xs text-[#92400e]">
          {lead.relayed_at ? formatDate(lead.relayed_at) : '--'}
        </span>
      </div>
    </div>
  )
}

export default function LeadRelayDashboard() {
  const [unrelayedLeads, setUnrelayedLeads] = useState<LeadRow[]>([])
  const [relayedLeads, setRelayedLeads] = useState<LeadRow[]>([])
  const [loading, setLoading] = useState(true)
  const [relaying, setRelaying] = useState<string | null>(null)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadLeads = useCallback(async () => {
    const [unrelayedResult, relayedResult] = await Promise.all([
      getUnrelayedLeadsAction(),
      getRelayedLeadsAction(),
    ])

    if (unrelayedResult.success && unrelayedResult.leads) {
      setUnrelayedLeads(unrelayedResult.leads)
    }
    if (relayedResult.success && relayedResult.leads) {
      setRelayedLeads(relayedResult.leads)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    loadLeads()
  }, [loadLeads])

  const showFeedback = useCallback((message: string) => {
    setFeedbackMessage(message)
    setTimeout(() => setFeedbackMessage(null), 3000)
  }, [])

  const handleRelay = useCallback(
    async (claimId: string, method: RelayMethod) => {
      setRelaying(claimId)
      const result = await markLeadRelayedAction(claimId, method)
      setRelaying(null)

      if (result.success) {
        showFeedback(
          `Lead relayed via ${relayMethodConfig[method].label.toLowerCase()}`,
        )
        await loadLeads()
      } else {
        showFeedback(`Error: ${result.error || 'Failed to relay lead'}`)
      }
    },
    [loadLeads, showFeedback],
  )

  const stats = useMemo(() => {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const relayedToday = relayedLeads.filter(
      (l) => l.relayed_at && new Date(l.relayed_at) >= todayStart,
    ).length

    return {
      pending: unrelayedLeads.length,
      relayedToday,
      totalRelayed: relayedLeads.length,
    }
  }, [unrelayedLeads, relayedLeads])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} className="animate-spin text-amber-800" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#451a03]">Lead Relay</h1>
          <p className="text-[#78350f] mt-1">
            Relay consumer leads to businesses
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setLoading(true)
            loadLeads()
          }}
          className="gap-1.5"
        >
          <ArrowClockwise size={16} />
          Refresh
        </Button>
      </div>

      {/* Feedback message */}
      {feedbackMessage && (
        <div className="bg-emerald-600/10 border border-emerald-600/20 text-emerald-600 px-4 py-3 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2 duration-300">
          {feedbackMessage}
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <MetricCard
          icon={Clock}
          value={stats.pending}
          label="Pending Leads"
          highlight={stats.pending > 0}
        />
        <MetricCard
          icon={CheckCircle}
          value={stats.relayedToday}
          label="Relayed Today"
        />
        <MetricCard
          icon={UserCircle}
          value={stats.totalRelayed}
          label="Total Relayed"
        />
      </div>

      {/* Pending Queue */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-3">
          Pending Queue
          {unrelayedLeads.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#92400e]">
              ({unrelayedLeads.length})
            </span>
          )}
        </h2>

        {unrelayedLeads.length === 0 ? (
          <Card variant="glass" padding="lg" className="text-center">
            <CheckCircle
              size={40}
              weight="light"
              className="text-emerald-600 mx-auto mb-2"
            />
            <p className="text-[#451a03] font-medium">All caught up</p>
            <p className="text-sm text-[#78350f] mt-1">
              No pending leads to relay
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {unrelayedLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onRelay={handleRelay}
                relaying={relaying}
              />
            ))}
          </div>
        )}
      </div>

      {/* Relayed History */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-3">
          Recently Relayed
          {relayedLeads.length > 0 && (
            <span className="ml-2 text-sm font-normal text-[#92400e]">
              ({relayedLeads.length})
            </span>
          )}
        </h2>

        {relayedLeads.length === 0 ? (
          <Card variant="glass" padding="lg" className="text-center">
            <p className="text-sm text-[#78350f]">
              No leads have been relayed yet
            </p>
          </Card>
        ) : (
          <Card variant="glass" padding="md">
            {relayedLeads.map((lead) => (
              <RelayedLeadRow key={lead.id} lead={lead} />
            ))}
          </Card>
        )}
      </div>
    </div>
  )
}
