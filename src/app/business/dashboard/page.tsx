'use client'

import { Tag, Users, ChatCircle, Eye, TrendUp, TrendDown } from '@phosphor-icons/react'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getBusinessById } from '@/lib/mock-data/businesses'
import { Card } from '@/components/ui/card'

interface MetricCardProps {
  icon: React.ComponentType<{ size?: number; weight?: 'light' | 'fill'; className?: string }>
  value: string | number
  label: string
  trend?: {
    direction: 'up' | 'down' | 'neutral'
    value: string
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
              trend.direction === 'up'
                ? 'text-emerald-600'
                : trend.direction === 'down'
                  ? 'text-red-600'
                  : 'text-[#78350f]'
            }`}
          >
            {trend.direction === 'up' && <TrendUp size={16} weight="bold" />}
            {trend.direction === 'down' && <TrendDown size={16} weight="bold" />}
            <span>{trend.value}</span>
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

export default function BusinessDashboardPage() {
  const { state } = useBusinessAuth()
  const business = state.owner?.businessId ? getBusinessById(state.owner.businessId) : null

  // Mock metrics data
  const metrics = [
    {
      icon: Tag,
      value: 5,
      label: 'Active Deals',
      trend: { direction: 'up' as const, value: '+2 this week' },
    },
    {
      icon: Users,
      value: 12,
      label: 'New Leads',
      trend: { direction: 'up' as const, value: '+8 this week' },
    },
    {
      icon: ChatCircle,
      value: 3,
      label: 'Messages Awaiting Reply',
      trend: { direction: 'neutral' as const, value: 'Reply within 24h' },
    },
    {
      icon: Eye,
      value: '1,234',
      label: 'Total Views This Month',
      trend: { direction: 'up' as const, value: '+15%' },
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">
          Welcome back{business?.name ? `, ${business.name}` : ''}
        </h1>
        <p className="text-[#78350f] mt-1">
          Here&apos;s an overview of your business performance
        </p>
      </div>

      {/* Metrics Grid */}
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

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card variant="glass" padding="md" hover className="group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                <Tag size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <p className="font-medium text-[#451a03]">Create New Deal</p>
                <p className="text-sm text-[#78350f]">Add a special offer</p>
              </div>
            </div>
          </Card>
          <Card variant="glass" padding="md" hover className="group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                <Users size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <p className="font-medium text-[#451a03]">View Leads</p>
                <p className="text-sm text-[#78350f]">12 new this week</p>
              </div>
            </div>
          </Card>
          <Card variant="glass" padding="md" hover className="group">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                <ChatCircle size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <p className="font-medium text-[#451a03]">Reply to Messages</p>
                <p className="text-sm text-[#78350f]">3 awaiting response</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
