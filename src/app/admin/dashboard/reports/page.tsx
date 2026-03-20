'use client'

import { useState } from 'react'
import {
  CurrencyDollar,
  Storefront,
  Ticket,
  Users,
  TrendUp,
  TrendDown,
  Clock,
  CheckCircle,
  Star,
  ArrowUp,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { businesses } from '@/lib/mock-data/businesses'
import { consumers } from '@/lib/mock-data/consumers'
import { getCategories } from '@/lib/mock-data/categories'

type TimePeriod = '7d' | '30d' | '90d' | 'all'

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number; weight?: 'light' | 'fill'; className?: string }>
  value: string | number
  label: string
  trend?: {
    value: string
    positive: boolean
  }
}

function MetricCard({ icon: Icon, value, label, trend }: MetricCardProps) {
  return (
    <Card variant="glass" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
        <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
          <Icon size={24} weight="fill" className="text-amber-800" />
        </div>
        {trend && (
          <div
            className={`flex items-center gap-1 text-sm font-medium ${
              trend.positive ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {trend.positive ? <TrendUp size={16} weight="bold" /> : <TrendDown size={16} weight="bold" />}
            {trend.value}
          </div>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#451a03]">{value}</p>
        <p className="text-sm text-[#78350f] mt-1">{label}</p>
      </div>
    </Card>
  )
}

// Mock platform activity data
const platformActivities = [
  { id: 'act-1', type: 'new_business', description: 'New business registered: Serene Spa', timestamp: '2 hours ago' },
  { id: 'act-2', type: 'new_claim', description: 'New claim submitted for Botox Special', timestamp: '3 hours ago' },
  { id: 'act-3', type: 'deal_approved', description: 'Deal approved: Summer Facial Package', timestamp: '4 hours ago' },
  { id: 'act-4', type: 'tier_upgrade', description: 'Elite Aesthetics upgraded to Premium', timestamp: '5 hours ago' },
  { id: 'act-5', type: 'new_user', description: 'New user registered: Emily S.', timestamp: '6 hours ago' },
  { id: 'act-6', type: 'deal_approved', description: 'Deal approved: Lip Filler Special', timestamp: '8 hours ago' },
  { id: 'act-7', type: 'new_claim', description: 'New claim submitted for HydraFacial', timestamp: '10 hours ago' },
  { id: 'act-8', type: 'new_business', description: 'New business registered: Glow Up Studio', timestamp: '12 hours ago' },
  { id: 'act-9', type: 'new_user', description: 'New user registered: Michael R.', timestamp: '14 hours ago' },
  { id: 'act-10', type: 'tier_upgrade', description: 'Luxe Skin Studio upgraded to Free tier', timestamp: '1 day ago' },
]

function getActivityIcon(type: string) {
  switch (type) {
    case 'new_business':
      return Storefront
    case 'new_claim':
      return Ticket
    case 'deal_approved':
      return CheckCircle
    case 'tier_upgrade':
      return Star
    case 'new_user':
      return Users
    default:
      return Clock
  }
}

function getActivityBadgeVariant(type: string): 'success' | 'info' | 'warning' | 'default' {
  switch (type) {
    case 'new_business':
      return 'info'
    case 'new_claim':
      return 'warning'
    case 'deal_approved':
      return 'success'
    case 'tier_upgrade':
      return 'success'
    case 'new_user':
      return 'info'
    default:
      return 'default'
  }
}

function getActivityLabel(type: string): string {
  switch (type) {
    case 'new_business':
      return 'New Business'
    case 'new_claim':
      return 'New Claim'
    case 'deal_approved':
      return 'Deal Approved'
    case 'tier_upgrade':
      return 'Tier Upgrade'
    case 'new_user':
      return 'New User'
    default:
      return 'Activity'
  }
}

export default function AdminReportsPage() {
  const [timePeriod, setTimePeriod] = useState<TimePeriod>('30d')

  // Calculate metrics from mock data
  const activeBusinesses = businesses.filter((b) => b.status === 'active').length
  const totalConsumers = consumers.length

  // Get categories for top performing section
  const categories = getCategories()

  // Mock business activity data
  const businessActivity = [
    { metric: 'New Businesses', thisPeriod: 12, change: '+25%', positive: true },
    { metric: 'New Claims', thisPeriod: 156, change: '+18%', positive: true },
    { metric: 'Deal Views', thisPeriod: '4.2K', change: '+34%', positive: true },
    { metric: 'Messages Sent', thisPeriod: 89, change: '-5%', positive: false },
  ]

  // Top categories with mock claim counts
  const topCategories = categories.slice(0, 5).map((cat, index) => ({
    name: cat.name,
    claims: [342, 287, 254, 198, 156][index],
    percentage: [100, 84, 74, 58, 46][index],
  }))

  const metrics = [
    {
      icon: CurrencyDollar,
      value: '$847,250',
      label: 'Total Platform Revenue',
      trend: { value: '+18%', positive: true },
    },
    {
      icon: Storefront,
      value: activeBusinesses,
      label: 'Active Businesses',
      trend: { value: '+8', positive: true },
    },
    {
      icon: Ticket,
      value: '1,234',
      label: 'Monthly Claims',
      trend: { value: '+23%', positive: true },
    },
    {
      icon: Users,
      value: totalConsumers,
      label: 'Total Users',
      trend: { value: '+156', positive: true },
    },
  ]

  const timePeriods: { value: TimePeriod; label: string }[] = [
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: 'all', label: 'All Time' },
  ]

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">Platform Reports</h1>
        <p className="text-[#78350f] mt-1">Platform-wide performance and analytics</p>
      </div>

      {/* Time Period Selector */}
      <div className="flex flex-wrap gap-2">
        {timePeriods.map((period) => (
          <button
            key={period.value}
            type="button"
            onClick={() => setTimePeriod(period.value)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
              timePeriod === period.value
                ? 'bg-amber-800 text-white'
                : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03]'
            }`}
          >
            {period.label}
          </button>
        ))}
      </div>

      {/* Platform Health Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">Platform Health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              icon={metric.icon}
              value={metric.value}
              label={metric.label}
              trend={metric.trend}
            />
          ))}
        </div>
      </div>

      {/* Growth Trends Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Business Activity */}
        <div>
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">Business Activity</h2>
          <Card variant="glass" padding="none">
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#d4c4b0]">
                    <th className="text-left px-4 py-3 text-sm font-medium text-[#78350f]">Metric</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-[#78350f]">This Period</th>
                    <th className="text-right px-4 py-3 text-sm font-medium text-[#78350f]">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#d4c4b0]">
                  {businessActivity.map((row) => (
                    <tr key={row.metric} className="hover:bg-[#faf5ee] transition-colors">
                      <td className="px-4 py-3 text-sm text-[#451a03] font-medium">{row.metric}</td>
                      <td className="px-4 py-3 text-sm text-[#451a03] text-right">{row.thisPeriod}</td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className={`inline-flex items-center gap-1 text-sm font-medium ${
                            row.positive ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {row.positive ? <ArrowUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                          {row.change}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden divide-y divide-[#d4c4b0]">
              {businessActivity.map((row) => (
                <div key={row.metric} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#451a03]">{row.metric}</p>
                    <p className="text-lg font-semibold text-[#451a03] mt-0.5">{row.thisPeriod}</p>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1 text-sm font-medium ${
                      row.positive ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {row.positive ? <ArrowUp size={14} weight="bold" /> : <TrendDown size={14} weight="bold" />}
                    {row.change}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Top Performing Categories */}
        <div>
          <h2 className="text-lg font-semibold text-[#451a03] mb-4">Top Performing Categories</h2>
          <Card variant="glass" padding="md">
            <div className="space-y-4">
              {topCategories.map((category) => (
                <div key={category.name} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-[#451a03]">{category.name}</span>
                    <span className="text-sm text-[#78350f]">{category.claims} claims</span>
                  </div>
                  <div className="h-2 bg-[#f2ebe2] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-800 rounded-full transition-all duration-500"
                      style={{ width: `${category.percentage}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Platform Activity */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">Recent Platform Activity</h2>
        <Card variant="glass" padding="none">
          <div className="divide-y divide-[#d4c4b0]">
            {platformActivities.map((activity) => {
              const IconComponent = getActivityIcon(activity.type)
              return (
                <div
                  key={activity.id}
                  className="flex items-center gap-4 p-4 hover:bg-[#faf5ee] transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                    <IconComponent size={20} weight="fill" className="text-amber-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[#451a03] truncate">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <Badge variant={getActivityBadgeVariant(activity.type)} size="sm">
                      {getActivityLabel(activity.type)}
                    </Badge>
                    <span className="text-xs text-[#92400e] whitespace-nowrap">{activity.timestamp}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>
    </div>
  )
}
