'use client'

import {
  Buildings,
  Database,
  Flag,
  Gear,
  House,
  Megaphone,
  Tag,
  Users,
} from '@phosphor-icons/react'
import { NotificationBell } from '@/components/patterns/notificationBell'
import { useAdminAuth } from '@/lib/context/adminAuthContext'
import { BaseSidebar, type NavItem } from './baseSidebar'

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Home', icon: House },
  { href: '/admin/dashboard/deals', label: 'Deals', icon: Tag },
  { href: '/admin/dashboard/leads', label: 'Leads', icon: Megaphone },
  // Deal reports, claim answers and owners' correction requests (deal_reports, offer_confirmations).
  { href: '/admin/dashboard/feedback', label: 'Feedback', icon: Flag },
  { href: '/admin/dashboard/users', label: 'Users', icon: Users },
  { href: '/admin/dashboard/businesses', label: 'Businesses', icon: Buildings },
  // Content and Reports are gone, not hidden. /admin/dashboard/content/treatments
  // invented 15 treatments and their prices; /admin/dashboard/reports invented
  // $847,250 of platform revenue and a ten-entry activity feed. Categories and
  // Locations wrote real, audited rows to content_categories / content_locations —
  // tables no other surface in the codebase reads, so an admin editing them changed
  // nothing they could see. The rows are still in the database; re-add the screens
  // when something consumes them. Monetization went on 2026-09-24: a mock-up with sample
  // numbers and no payment processor behind it.
  { href: '/admin/dashboard/data', label: 'Data', icon: Database },
  { href: '/admin/dashboard/settings', label: 'Settings', icon: Gear },
]

export function AdminDashboardSidebar() {
  const { state, signOut } = useAdminAuth()
  const admin = state.admin

  return (
    <BaseSidebar
      navItems={navItems}
      baseRoute="/admin/dashboard"
      user={
        admin
          ? {
              displayName: admin.firstName
                ? `${admin.firstName} ${admin.lastName}`
                : admin.email || 'Admin',
              initial:
                admin.firstName?.[0]?.toUpperCase() ||
                admin.email?.[0]?.toUpperCase() ||
                'A',
            }
          : null
      }
      onSignOut={signOut}
      mobileNavCount={4}
      extraActions={<NotificationBell placement="beside" />}
    />
  )
}
