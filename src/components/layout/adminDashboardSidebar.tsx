'use client'

import {
  Buildings,
  ChartBar,
  CurrencyDollar,
  Database,
  FolderSimple,
  Gear,
  House,
  Tag,
  Users,
} from '@phosphor-icons/react'
import { useAdminAuth } from '@/lib/context/adminAuthContext'
import { BaseSidebar, type NavItem } from './baseSidebar'

const navItems: NavItem[] = [
  { href: '/admin/dashboard', label: 'Home', icon: House },
  { href: '/admin/dashboard/deals', label: 'Deals', icon: Tag },
  { href: '/admin/dashboard/users', label: 'Users', icon: Users },
  { href: '/admin/dashboard/businesses', label: 'Businesses', icon: Buildings },
  { href: '/admin/dashboard/content', label: 'Content', icon: FolderSimple },
  { href: '/admin/dashboard/reports', label: 'Reports', icon: ChartBar },
  {
    href: '/admin/dashboard/monetization',
    label: 'Monetization',
    icon: CurrencyDollar,
  },
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
    />
  )
}
