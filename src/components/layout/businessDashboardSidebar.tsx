'use client'

import {
  Buildings,
  ChartLine,
  ChatCircle,
  CurrencyDollar,
  Gear,
  House,
  Tag,
  Users,
} from '@phosphor-icons/react'
import { NotificationBell } from '@/components/patterns/notificationBell'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { BaseSidebar, type NavItem } from './baseSidebar'

const navItems: NavItem[] = [
  { href: '/business/dashboard', label: 'Home', icon: House },
  { href: '/business/dashboard/deals', label: 'Deals', icon: Tag },
  { href: '/business/dashboard/leads', label: 'Leads', icon: Users },
  {
    href: '/business/dashboard/pricing',
    label: 'Pricing',
    icon: CurrencyDollar,
  },
  { href: '/business/dashboard/messages', label: 'Messages', icon: ChatCircle },
  {
    href: '/business/dashboard/analytics',
    label: 'Analytics',
    icon: ChartLine,
  },
  { href: '/business/dashboard/profile', label: 'Profile', icon: Buildings },
  { href: '/business/dashboard/settings', label: 'Settings', icon: Gear },
]

export function BusinessDashboardSidebar() {
  const { state, signOut } = useBusinessAuth()
  const owner = state.owner

  return (
    <BaseSidebar
      navItems={navItems}
      baseRoute="/business/dashboard"
      user={
        owner
          ? {
              displayName: owner.firstName || owner.email || 'Business Owner',
              initial:
                owner.firstName?.[0]?.toUpperCase() ||
                owner.email?.[0]?.toUpperCase() ||
                'B',
            }
          : null
      }
      onSignOut={signOut}
      mobileNavCount={4}
      extraActions={<NotificationBell />}
    />
  )
}
