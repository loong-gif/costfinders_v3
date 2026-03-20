'use client'

import { useState } from 'react'
import {
  FileArrowDown,
  Buildings,
  Users,
  Database,
  Archive,
  Trash,
  Bell,
  CheckCircle,
  Warning,
  XCircle,
  Clock,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

// Mock counts for bulk actions
const mockCounts = {
  pendingDeals: 8,
  expiredDeals: 12,
  cancelledClaims: 5,
}

// Mock activity log entries
const mockActivityLog = [
  {
    id: 'act-1',
    timestamp: '2024-03-15T14:30:00Z',
    admin: 'Sarah Johnson',
    action: 'Approved deal',
    details: 'Spring Botox Special',
    status: 'success',
  },
  {
    id: 'act-2',
    timestamp: '2024-03-15T13:45:00Z',
    admin: 'Mike Chen',
    action: 'Exported deals',
    details: '245 deals to CSV',
    status: 'success',
  },
  {
    id: 'act-3',
    timestamp: '2024-03-15T12:20:00Z',
    admin: 'Sarah Johnson',
    action: 'Suspended user',
    details: 'john@example.com',
    status: 'success',
  },
  {
    id: 'act-4',
    timestamp: '2024-03-15T11:00:00Z',
    admin: 'Mike Chen',
    action: 'Updated business tier',
    details: 'Elite Med Spa → Premium',
    status: 'success',
  },
  {
    id: 'act-5',
    timestamp: '2024-03-14T16:30:00Z',
    admin: 'Sarah Johnson',
    action: 'Rejected deal',
    details: 'Discount Filler Special - Policy violation',
    status: 'warning',
  },
  {
    id: 'act-6',
    timestamp: '2024-03-14T15:00:00Z',
    admin: 'Admin System',
    action: 'Auto-archived deals',
    details: '15 expired deals archived',
    status: 'success',
  },
  {
    id: 'act-7',
    timestamp: '2024-03-14T10:15:00Z',
    admin: 'Mike Chen',
    action: 'Exported users',
    details: '1,234 users to JSON',
    status: 'success',
  },
  {
    id: 'act-8',
    timestamp: '2024-03-13T14:45:00Z',
    admin: 'Sarah Johnson',
    action: 'Bulk approve',
    details: 'Approved 5 pending deals',
    status: 'success',
  },
  {
    id: 'act-9',
    timestamp: '2024-03-13T11:30:00Z',
    admin: 'Mike Chen',
    action: 'Failed export',
    details: 'Business export timeout',
    status: 'failed',
  },
  {
    id: 'act-10',
    timestamp: '2024-03-12T09:00:00Z',
    admin: 'Admin System',
    action: 'Cleanup claims',
    details: 'Removed 8 cancelled claims',
    status: 'success',
  },
]

type ExportFormat = 'csv' | 'json'
type DateRange = '30days' | 'all'
type UserFilter = 'all' | 'verified'
type ActivityFilter = 'all' | 'exports' | 'moderation' | 'user-actions'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 1) {
    return `${diffDays} days ago`
  }
  if (diffDays === 1) {
    return 'Yesterday'
  }
  if (diffHours > 0) {
    return `${diffHours}h ago`
  }
  return 'Just now'
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'success':
      return <CheckCircle size={16} weight="fill" className="text-emerald-600" />
    case 'warning':
      return <Warning size={16} weight="fill" className="text-amber-800" />
    case 'failed':
      return <XCircle size={16} weight="fill" className="text-red-600" />
    default:
      return <Clock size={16} weight="fill" className="text-[#92400e]" />
  }
}

function getStatusBadgeVariant(status: string): 'success' | 'warning' | 'error' | 'default' {
  switch (status) {
    case 'success':
      return 'success'
    case 'warning':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'default'
  }
}

function filterActivities(activities: typeof mockActivityLog, filter: ActivityFilter) {
  if (filter === 'all') return activities
  if (filter === 'exports') {
    return activities.filter((a) => a.action.toLowerCase().includes('export'))
  }
  if (filter === 'moderation') {
    return activities.filter(
      (a) =>
        a.action.toLowerCase().includes('approved') ||
        a.action.toLowerCase().includes('rejected') ||
        a.action.toLowerCase().includes('suspended') ||
        a.action.toLowerCase().includes('archived')
    )
  }
  if (filter === 'user-actions') {
    return activities.filter(
      (a) =>
        a.action.toLowerCase().includes('user') ||
        a.action.toLowerCase().includes('tier') ||
        a.action.toLowerCase().includes('business')
    )
  }
  return activities
}

export default function DataManagementPage() {
  const [dealsFormat, setDealsFormat] = useState<ExportFormat>('csv')
  const [dealsDateRange, setDealsDateRange] = useState<DateRange>('30days')
  const [includeInactive, setIncludeInactive] = useState(false)
  const [userFilter, setUserFilter] = useState<UserFilter>('all')
  const [activityFilter, setActivityFilter] = useState<ActivityFilter>('all')

  const handleExport = (type: string) => {
    console.log(`Export started: ${type}`)
  }

  const filteredActivities = filterActivities(mockActivityLog, activityFilter)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">Data Management</h1>
        <p className="text-[#78350f] mt-1">
          Export, import, and manage platform data
        </p>
      </div>

      {/* Export Tools Section */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">Export Tools</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Export Deals Card */}
          <Card variant="glass" padding="lg" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <FileArrowDown size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <h3 className="font-semibold text-[#451a03]">Export Deals</h3>
                <p className="text-sm text-[#78350f]">Download all deals as CSV</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#78350f] mb-1 block">Format</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDealsFormat('csv')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      dealsFormat === 'csv'
                        ? 'bg-amber-800 text-white'
                        : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                    }`}
                  >
                    CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealsFormat('json')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      dealsFormat === 'json'
                        ? 'bg-amber-800 text-white'
                        : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                    }`}
                  >
                    JSON
                  </button>
                </div>
              </div>

              <div>
                <label className="text-sm text-[#78350f] mb-1 block">Date Range</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setDealsDateRange('30days')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      dealsDateRange === '30days'
                        ? 'bg-amber-800 text-white'
                        : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                    }`}
                  >
                    Last 30 days
                  </button>
                  <button
                    type="button"
                    onClick={() => setDealsDateRange('all')}
                    className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                      dealsDateRange === 'all'
                        ? 'bg-amber-800 text-white'
                        : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee]'
                    }`}
                  >
                    All time
                  </button>
                </div>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={() => handleExport(`deals-${dealsFormat}-${dealsDateRange}`)}
            >
              Export Deals
            </Button>
          </Card>

          {/* Export Businesses Card */}
          <Card variant="glass" padding="lg" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <Buildings size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <h3 className="font-semibold text-[#451a03]">Export Businesses</h3>
                <p className="text-sm text-[#78350f]">Download business directory</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="w-4 h-4 rounded border-[#d4c4b0] bg-[#f2ebe2] text-amber-800 focus:ring-amber-800 focus:ring-offset-0"
                />
                <span className="text-sm text-[#78350f]">Include inactive businesses</span>
              </label>
            </div>

            <Button
              variant="primary"
              className="w-full mt-auto"
              onClick={() => handleExport(`businesses-${includeInactive ? 'all' : 'active'}`)}
            >
              Export Businesses
            </Button>
          </Card>

          {/* Export Users Card */}
          <Card variant="glass" padding="lg" className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <Users size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <h3 className="font-semibold text-[#451a03]">Export Users</h3>
                <p className="text-sm text-[#78350f]">Download consumer data</p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-sm text-[#78350f] mb-1 block">Filter</label>
                <select
                  value={userFilter}
                  onChange={(e) => setUserFilter(e.target.value as UserFilter)}
                  className="w-full px-3 py-2 bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg text-[#451a03] text-sm focus:outline-none focus:ring-2 focus:ring-amber-800/40"
                >
                  <option value="all">All Users</option>
                  <option value="verified">Verified Only</option>
                </select>
              </div>
            </div>

            <Button
              variant="primary"
              className="w-full mt-auto"
              onClick={() => handleExport(`users-${userFilter}`)}
            >
              Export Users
            </Button>
          </Card>
        </div>
      </div>

      {/* Bulk Actions Section */}
      <div>
        <h2 className="text-lg font-semibold text-[#451a03] mb-4">Bulk Actions</h2>
        <Card variant="glass" padding="lg">
          <p className="text-[#78350f] mb-4">
            Perform operations on multiple records at once
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button variant="secondary" className="justify-between" disabled>
              <span className="flex items-center gap-2">
                <CheckCircle size={18} />
                Approve All Pending Deals
              </span>
              <Badge variant="warning" size="sm">
                {mockCounts.pendingDeals}
              </Badge>
            </Button>

            <Button variant="secondary" className="justify-between" disabled>
              <span className="flex items-center gap-2">
                <Bell size={18} />
                Notify Inactive Businesses
              </span>
              <Badge variant="info" size="sm">
                Coming Soon
              </Badge>
            </Button>

            <Button variant="secondary" className="justify-between" disabled>
              <span className="flex items-center gap-2">
                <Archive size={18} />
                Archive Expired Deals
              </span>
              <Badge variant="default" size="sm">
                {mockCounts.expiredDeals}
              </Badge>
            </Button>

            <Button variant="secondary" className="justify-between" disabled>
              <span className="flex items-center gap-2">
                <Trash size={18} />
                Cleanup Cancelled Claims
              </span>
              <Badge variant="default" size="sm">
                {mockCounts.cancelledClaims}
              </Badge>
            </Button>
          </div>
        </Card>
      </div>

      {/* Activity Log Section */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-[#451a03]">Admin Activity Log</h2>
            <p className="text-sm text-[#78350f]">Last 50 actions</p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {[
            { id: 'all', label: 'All' },
            { id: 'exports', label: 'Exports' },
            { id: 'moderation', label: 'Moderation' },
            { id: 'user-actions', label: 'User Actions' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActivityFilter(tab.id as ActivityFilter)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                activityFilter === tab.id
                  ? 'bg-amber-800 text-white'
                  : 'bg-[#f2ebe2] text-[#78350f] hover:bg-[#faf5ee] hover:text-[#451a03]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Activity Table */}
        <Card variant="glass" padding="none">
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full min-w-[600px]">
              <thead>
                <tr className="border-b border-[#d4c4b0]">
                  <th className="text-left p-4 text-sm font-semibold text-[#78350f]">
                    Timestamp
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-[#78350f]">
                    Admin
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-[#78350f]">
                    Action
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-[#78350f]">
                    Details
                  </th>
                  <th className="text-left p-4 text-sm font-semibold text-[#78350f]">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d4c4b0]">
                {filteredActivities.map((activity) => (
                  <tr
                    key={activity.id}
                    className="hover:bg-[#faf5ee] transition-colors"
                  >
                    <td className="p-4 text-sm text-[#92400e] whitespace-nowrap">
                      {formatRelativeTime(activity.timestamp)}
                    </td>
                    <td className="p-4 text-sm text-[#451a03]">
                      {activity.admin}
                    </td>
                    <td className="p-4 text-sm text-[#451a03] font-medium">
                      {activity.action}
                    </td>
                    <td className="p-4 text-sm text-[#78350f]">
                      {activity.details}
                    </td>
                    <td className="p-4">
                      <Badge variant={getStatusBadgeVariant(activity.status)} size="sm">
                        <span className="flex items-center gap-1.5">
                          {getStatusIcon(activity.status)}
                          {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                        </span>
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-[#d4c4b0]">
            {filteredActivities.map((activity) => (
              <div key={activity.id} className="p-4">
                {/* Header: Timestamp + Status */}
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-[#92400e]">
                    {formatRelativeTime(activity.timestamp)}
                  </span>
                  <Badge variant={getStatusBadgeVariant(activity.status)} size="sm">
                    <span className="flex items-center gap-1.5">
                      {getStatusIcon(activity.status)}
                      {activity.status.charAt(0).toUpperCase() + activity.status.slice(1)}
                    </span>
                  </Badge>
                </div>
                {/* Action + Admin */}
                <p className="text-sm font-medium text-[#451a03]">{activity.action}</p>
                <p className="text-xs text-[#78350f] mt-0.5">by {activity.admin}</p>
                {/* Details */}
                <p className="text-sm text-[#78350f] mt-2 pt-2 border-t border-[#d4c4b0]">
                  {activity.details}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
