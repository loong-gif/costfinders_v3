'use client'

import {
  Eye,
  HandGrabbing,
  ChartLineUp,
  CurrencyDollar,
  TrendUp,
  TrendDown,
  Info,
  Crown,
  Calendar,
  Clock,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tooltip } from '@/components/ui/tooltip'

interface MetricCardProps {
  title: string
  value: string
  change?: string
  changeType?: 'positive' | 'negative' | 'neutral'
  icon: React.ReactNode
  tooltip: string
}

function MetricCard({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  tooltip,
}: MetricCardProps) {
  return (
    <Card variant="glass" padding="lg">
      <div className="flex items-start justify-between mb-4">
        <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
          {icon}
        </div>
        <Tooltip content={tooltip}>
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <Info size={16} weight="regular" className="text-stone-500" />
          </button>
        </Tooltip>
      </div>
      <div>
        <p className="text-sm text-stone-400 mb-1">{title}</p>
        <p className="text-2xl font-bold text-stone-100">{value}</p>
        {change && (
          <div className="flex items-center gap-1 mt-2">
            {changeType === 'positive' ? (
              <TrendUp size={14} weight="fill" className="text-success" />
            ) : changeType === 'negative' ? (
              <TrendDown size={14} weight="fill" className="text-error" />
            ) : null}
            <span
              className={`text-sm ${
                changeType === 'positive'
                  ? 'text-success'
                  : changeType === 'negative'
                    ? 'text-error'
                    : 'text-stone-500'
              }`}
            >
              {change}
            </span>
          </div>
        )}
      </div>
    </Card>
  )
}

interface DealPerformance {
  id: string
  title: string
  views: number
  claims: number
  conversionRate: number
  status: 'active' | 'paused' | 'expired'
}

// Mock deal performance data
const dealPerformanceData: DealPerformance[] = [
  {
    id: '1',
    title: 'Premium Botox Treatment',
    views: 523,
    claims: 24,
    conversionRate: 4.6,
    status: 'active',
  },
  {
    id: '2',
    title: 'Hydrafacial Package',
    views: 412,
    claims: 12,
    conversionRate: 2.9,
    status: 'active',
  },
  {
    id: '3',
    title: 'Laser Hair Removal - Full Legs',
    views: 189,
    claims: 6,
    conversionRate: 3.2,
    status: 'active',
  },
  {
    id: '4',
    title: 'Chemical Peel Treatment',
    views: 87,
    claims: 2,
    conversionRate: 2.3,
    status: 'paused',
  },
  {
    id: '5',
    title: 'Lip Filler Special',
    views: 23,
    claims: 1,
    conversionRate: 4.3,
    status: 'expired',
  },
]

function DealPerformanceTable() {
  const topDeal = dealPerformanceData.reduce((a, b) =>
    a.claims > b.claims ? a : b
  )

  return (
    <Card variant="glass" padding="lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-stone-100">
            Deal Performance
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            How your deals are performing
          </p>
        </div>
        <Tooltip content="Performance data based on the last 30 days">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <Info size={16} weight="regular" className="text-stone-500" />
          </button>
        </Tooltip>
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-stone-800">
              <th className="text-left pb-3 text-sm font-medium text-stone-400">
                Deal
              </th>
              <th className="text-right pb-3 text-sm font-medium text-stone-400">
                Views
              </th>
              <th className="text-right pb-3 text-sm font-medium text-stone-400">
                Claims
              </th>
              <th className="text-right pb-3 text-sm font-medium text-stone-400">
                Conv. %
              </th>
              <th className="text-right pb-3 text-sm font-medium text-stone-400">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-800">
            {dealPerformanceData.map((deal) => (
              <tr key={deal.id} className="group">
                <td className="py-3">
                  <div className="flex items-center gap-2">
                    {deal.id === topDeal.id && (
                      <Crown
                        size={16}
                        weight="fill"
                        className="text-yellow-500"
                      />
                    )}
                    <span className="text-sm text-stone-100 truncate max-w-[200px]">
                      {deal.title}
                    </span>
                  </div>
                </td>
                <td className="py-3 text-right">
                  <span className="text-sm text-stone-400">
                    {deal.views.toLocaleString()}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span className="text-sm text-stone-400">
                    {deal.claims}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <span
                    className={`text-sm ${
                      deal.conversionRate >= 4
                        ? 'text-success'
                        : deal.conversionRate >= 3
                          ? 'text-stone-100'
                          : 'text-stone-500'
                    }`}
                  >
                    {deal.conversionRate}%
                  </span>
                </td>
                <td className="py-3 text-right">
                  <Badge
                    variant={
                      deal.status === 'active'
                        ? 'success'
                        : deal.status === 'paused'
                          ? 'warning'
                          : 'default'
                    }
                    size="sm"
                  >
                    {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="sm:hidden space-y-3">
        {dealPerformanceData.map((deal) => (
          <div
            key={deal.id}
            className="p-4 bg-stone-900 rounded-xl border border-stone-800"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2 min-w-0">
                {deal.id === topDeal.id && (
                  <Crown size={16} weight="fill" className="text-yellow-500 flex-shrink-0" />
                )}
                <span className="text-sm font-medium text-stone-100 truncate">
                  {deal.title}
                </span>
              </div>
              <Badge
                variant={
                  deal.status === 'active'
                    ? 'success'
                    : deal.status === 'paused'
                      ? 'warning'
                      : 'default'
                }
                size="sm"
                className="flex-shrink-0 ml-2"
              >
                {deal.status.charAt(0).toUpperCase() + deal.status.slice(1)}
              </Badge>
            </div>
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-stone-800">
              <div className="flex items-center gap-4 text-sm">
                <div className="text-stone-400">
                  <span className="text-stone-500">Views:</span> {deal.views.toLocaleString()}
                </div>
                <div className="text-stone-400">
                  <span className="text-stone-500">Claims:</span> {deal.claims}
                </div>
              </div>
              <span
                className={`text-sm font-medium ${
                  deal.conversionRate >= 4
                    ? 'text-success'
                    : deal.conversionRate >= 3
                      ? 'text-stone-100'
                      : 'text-stone-500'
                }`}
              >
                {deal.conversionRate}%
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}

function TrendsSection() {
  const trends = [
    {
      icon: <TrendUp size={18} weight="fill" className="text-success" />,
      text: 'Views trending up 12% this month',
      type: 'positive' as const,
    },
    {
      icon: <ChartLineUp size={18} weight="fill" className="text-amber-400" />,
      text: 'Botox deals receive 40% of all claims',
      type: 'info' as const,
    },
    {
      icon: <Clock size={18} weight="fill" className="text-info" />,
      text: 'Peak activity: Weekday afternoons',
      type: 'info' as const,
    },
    {
      icon: <Calendar size={18} weight="fill" className="text-warning" />,
      text: 'Fridays see highest claim volume',
      type: 'info' as const,
    },
  ]

  return (
    <Card variant="glass" padding="lg">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-stone-100">
            Insights & Trends
          </h3>
          <p className="text-sm text-stone-500 mt-1">
            Key patterns in your performance
          </p>
        </div>
        <Tooltip content="Insights based on the last 30 days of activity">
          <button
            type="button"
            className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
          >
            <Info size={16} weight="regular" className="text-stone-500" />
          </button>
        </Tooltip>
      </div>

      <div className="space-y-4">
        {trends.map((trend, index) => (
          <div
            key={`trend-${
              // biome-ignore lint/suspicious/noArrayIndexKey: static list
              index
            }`}
            className="flex items-center gap-3 p-3 bg-stone-900 rounded-xl"
          >
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center flex-shrink-0">
              {trend.icon}
            </div>
            <p className="text-sm text-stone-100">{trend.text}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

export function AnalyticsDashboard() {
  const metrics = [
    {
      title: 'Total Views',
      value: '1,234',
      change: '+12% vs last month',
      changeType: 'positive' as const,
      icon: <Eye size={24} weight="fill" className="text-amber-400" />,
      tooltip: 'Total number of times your deals were viewed this month',
    },
    {
      title: 'Total Claims',
      value: '45',
      change: '+8% vs last month',
      changeType: 'positive' as const,
      icon: (
        <HandGrabbing size={24} weight="fill" className="text-amber-400" />
      ),
      tooltip: 'Number of customers who claimed your deals this month',
    },
    {
      title: 'Conversion Rate',
      value: '3.6%',
      change: '-0.2% vs last month',
      changeType: 'negative' as const,
      icon: (
        <ChartLineUp size={24} weight="fill" className="text-amber-400" />
      ),
      tooltip: 'Percentage of viewers who claimed a deal',
    },
    {
      title: 'Revenue Potential',
      value: '$12,450',
      change: '+$1,200 vs last month',
      changeType: 'positive' as const,
      icon: (
        <CurrencyDollar size={24} weight="fill" className="text-amber-400" />
      ),
      tooltip: 'Sum of deal prices for all claimed deals this month',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      {/* Performance & Trends */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DealPerformanceTable />
        <TrendsSection />
      </div>
    </div>
  )
}
