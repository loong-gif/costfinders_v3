'use client'

import {
  ClipboardText,
  Gear,
  Heart,
  House,
  MagnifyingGlass,
} from '@phosphor-icons/react'
import { useAuth } from '@/lib/context/authContext'
import { BaseSidebar, type NavItem } from './baseSidebar'

const navItems: NavItem[] = [
  { href: '/dashboard', label: 'Home', icon: House },
  { href: '/dashboard/favorites', label: 'Favorites', icon: Heart },
  { href: '/dashboard/claims', label: 'Claims', icon: ClipboardText },
  { href: '/deals', label: 'Browse', icon: MagnifyingGlass },
  { href: '/dashboard/settings', label: 'Settings', icon: Gear },
]

export function DashboardSidebar() {
  const { state, signOut } = useAuth()
  const user = state.user

  return (
    <BaseSidebar
      navItems={navItems}
      baseRoute="/dashboard"
      user={
        user
          ? {
              displayName: user.firstName || user.email || 'User',
              initial:
                user.firstName?.[0]?.toUpperCase() ||
                user.email?.[0]?.toUpperCase() ||
                'U',
            }
          : null
      }
      onSignOut={signOut}
    />
  )
}
