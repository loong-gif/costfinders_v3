'use client'

import {
  ArrowRight,
  Clock,
  FileText,
  Gear,
  MagnifyingGlass,
  Storefront,
  Tag,
  Users,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAdminAuth } from '@/lib/context/adminAuthContext'
import { consumers } from '@/lib/mock-data/consumers'

// Inline mock data for pending moderation items
const pendingModerationDeals = [
  {
    id: 'mod-1',
    title: 'Spring Botox Special',
    businessName: 'Glow Aesthetics',
    submittedAt: '2024-03-15T10:00:00Z',
  },
  {
    id: 'mod-2',
    title: 'Lip Filler Package',
    businessName: 'Elite Aesthetics',
    submittedAt: '2024-03-15T09:30:00Z',
  },
  {
    id: 'mod-3',
    title: 'HydraFacial Bundle',
    businessName: 'Luxe Skin Studio',
    submittedAt: '2024-03-14T16:45:00Z',
  },
  {
    id: 'mod-4',
    title: 'Laser Hair Removal Package',
    businessName: 'Radiance Med Spa',
    submittedAt: '2024-03-14T14:20:00Z',
  },
]

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
    <Card variant="glass" padding="lg" className="flex flex-col gap-4">
      <div className="flex items-start justify-between">
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
        {highlight && (
          <Badge variant="warning" size="sm">
            Action Needed
          </Badge>
        )}
      </div>
      <div>
        <p className="text-3xl font-bold text-[#451a03]">{value}</p>
        <p className="text-sm text-[#78350f] mt-1">{label}</p>
      </div>
    </Card>
  )
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 0) {
    return `${diffDays}d ago`
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  return 'Just now'
}

interface AdminDashboardClientProps {
  totalBusinesses: number
  totalOffers: number
}

export function AdminDashboardClient({
  totalBusinesses,
  totalOffers,
}: AdminDashboardClientProps) {
  const { state } = useAdminAuth()
  const admin = state.admin

  // Real counts from Supabase, mock for consumers (no real table yet)
  const pendingModeration = 8 // Mock count as specified
  const totalConsumers = consumers.length

  const metrics = [
    {
      icon: Tag,
      value: totalOffers,
      label: 'Total Offers',
    },
    {
      icon: Clock,
      value: pendingModeration,
      label: 'Pending Moderation',
      highlight: true,
    },
    {
      icon: Storefront,
      value: totalBusinesses,
      label: 'Total Businesses',
    },
    {
      icon: Users,
      value: totalConsumers,
      label: 'Total Consumers',
    },
  ]

  const quickActions = [
    {
      icon: MagnifyingGlass,
      title: 'Review Deals',
      description: 'Moderate pending submissions',
      href: '/admin/dashboard/deals',
    },
    {
      icon: Users,
      title: 'Manage Users',
      description: 'Consumer accounts',
      href: '/admin/dashboard/users',
    },
    {
      icon: Storefront,
      title: 'Manage Businesses',
      description: 'Business profiles',
      href: '/admin/dashboard/businesses',
    },
    {
      icon: Gear,
      title: 'Content Settings',
      description: 'Categories & locations',
      href: '/admin/dashboard/content',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">
          Welcome back, {admin?.firstName || 'Admin'}
        </h1>
        <p className="text-[#78350f] mt-1">
          Here&apos;s an overview of the platform activity
        </p>
      </div>

      {/* Platform Overview Metrics */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">
          Platform Overview
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.label}
              icon={metric.icon}
              value={metric.value}
              label={metric.label}
              highlight={metric.highlight}
            />
          ))}
        </div>
      </div>

      {/* Moderation Queue Preview */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#451a03]">
            Pending Review
          </h2>
          <Link href="/admin/dashboard/deals">
            <Button variant="ghost" size="sm" className="gap-1">
              View All <ArrowRight size={16} />
            </Button>
          </Link>
        </div>
        <Card variant="glass" padding="none">
          <div className="divide-y divide-[#d4c4b0]">
            {pendingModerationDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex items-center justify-between p-4 hover:bg-[#faf5ee] transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                    <FileText
                      size={20}
                      weight="fill"
                      className="text-amber-800"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-[#451a03]">{deal.title}</p>
                    <p className="text-sm text-[#78350f]">
                      {deal.businessName}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#92400e]">
                    {formatRelativeTime(deal.submittedAt)}
                  </span>
                  <Link href="/admin/dashboard/deals">
                    <Button variant="secondary" size="sm">
                      Review
                    </Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card variant="glass" padding="md" hover className="group h-full">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center group-hover:bg-amber-800/15 transition-colors">
                    <action.icon
                      size={20}
                      weight="fill"
                      className="text-amber-800"
                    />
                  </div>
                  <div>
                    <p className="font-medium text-[#451a03]">{action.title}</p>
                    <p className="text-sm text-[#78350f]">
                      {action.description}
                    </p>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
