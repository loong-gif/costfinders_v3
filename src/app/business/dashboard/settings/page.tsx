'use client'

import {
  Bell,
  CaretRight,
  CreditCard,
  Plugs,
  User,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useState } from 'react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

const settingsLinks = [
  {
    title: 'Profile',
    description: 'Update your business information and details',
    href: '/business/dashboard/profile',
    icon: User,
  },
  {
    title: 'Integrations',
    description: 'Connect scheduling and booking software',
    href: '/business/dashboard/settings/integrations',
    icon: Plugs,
  },
  {
    title: 'Account',
    description: 'View subscription and billing',
    href: '/business/dashboard/settings/account',
    icon: CreditCard,
  },
]

interface ToggleRowProps {
  label: string
  description: string
  enabled: boolean
  onToggle: () => void
  disabled?: boolean
}

function ToggleRow({
  label,
  description,
  enabled,
  onToggle,
  disabled = false,
}: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[#d4c4b0] last:border-b-0">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-[#451a03]">{label}</p>
        <p className="text-sm text-[#78350f] mt-0.5">{description}</p>
      </div>
      <button
        type="button"
        disabled={disabled}
        className={`relative flex-shrink-0 w-10 h-5 rounded-full transition-colors ${
          enabled ? 'bg-amber-800' : 'bg-[#d4c4b0]'
        } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={onToggle}
        aria-label={`Toggle ${label}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            enabled ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  )
}

export default function SettingsPage() {
  const [newLeadNotifs, setNewLeadNotifs] = useState(true)
  const [dealApprovalNotifs, setDealApprovalNotifs] = useState(true)

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {settingsLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.title} href={link.href}>
              <Card className="p-5 transition-all duration-200 hover:bg-[#faf5ee] cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
                    <Icon size={24} weight="light" className="text-amber-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[#451a03]">
                      {link.title}
                    </h3>
                    <p className="text-sm text-[#78350f] mt-0.5">
                      {link.description}
                    </p>
                  </div>
                  <CaretRight
                    size={20}
                    weight="light"
                    className="text-[#92400e]"
                  />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      {/* Notification Preferences */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <Bell size={20} weight="duotone" className="text-amber-800" />
            </div>
            <div>
              <CardTitle>Notification Preferences</CardTitle>
              <CardDescription>
                Control how you receive updates about your deals and leads
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-0">
            <ToggleRow
              label="New lead notifications"
              description="Get notified when a consumer claims one of your deals"
              enabled={newLeadNotifs}
              onToggle={() => setNewLeadNotifs((prev) => !prev)}
            />
            <ToggleRow
              label="Deal approval updates"
              description="Get notified when your deals are approved or need changes"
              enabled={dealApprovalNotifs}
              onToggle={() => setDealApprovalNotifs((prev) => !prev)}
            />
            <ToggleRow
              label="In-app notifications"
              description="Show notifications in the bell icon"
              enabled={true}
              onToggle={() => {}}
              disabled
            />
            <p className="text-xs text-[#78350f]/60 mt-3">
              In-app notifications are always enabled. Notification preferences
              are enabled by default.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
