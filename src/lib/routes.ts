/**
 * Route configuration for breadcrumb generation
 * Defines hierarchy and labels for all dashboard routes
 */

export interface RouteConfig {
  label: string
  parent?: string // Parent route path for hierarchy
}

export const routeConfig: Record<string, RouteConfig> = {
  // Consumer dashboard
  '/dashboard': { label: 'Dashboard' },
  '/dashboard/favorites': { label: 'Favorites', parent: '/dashboard' },
  '/dashboard/claims': { label: 'My Claims', parent: '/dashboard' },
  '/dashboard/settings': { label: 'Settings', parent: '/dashboard' },

  // Business dashboard
  '/business/dashboard': { label: 'Dashboard' },
  '/business/dashboard/deals': {
    label: 'Deals',
    parent: '/business/dashboard',
  },
  '/business/dashboard/deals/new': {
    label: 'New Deal',
    parent: '/business/dashboard/deals',
  },
  '/business/dashboard/deals/sponsored': {
    label: 'Sponsored',
    parent: '/business/dashboard/deals',
  },
  '/business/dashboard/leads': {
    label: 'Leads',
    parent: '/business/dashboard',
  },
  '/business/dashboard/leads/pricing': {
    label: 'Lead Pricing',
    parent: '/business/dashboard/leads',
  },
  '/business/dashboard/messages': {
    label: 'Messages',
    parent: '/business/dashboard',
  },
  '/business/dashboard/analytics': {
    label: 'Analytics',
    parent: '/business/dashboard',
  },
  '/business/dashboard/profile': {
    label: 'Profile',
    parent: '/business/dashboard',
  },
  '/business/dashboard/settings': {
    label: 'Settings',
    parent: '/business/dashboard',
  },
  '/business/dashboard/settings/integrations': {
    label: 'Integrations',
    parent: '/business/dashboard/settings',
  },
  '/business/dashboard/settings/account': {
    label: 'Account & Billing',
    parent: '/business/dashboard/settings',
  },
  '/business/dashboard/settings/account/checkout': {
    label: 'Checkout',
    parent: '/business/dashboard/settings/account',
  },

  // Admin dashboard
  '/admin/dashboard': { label: 'Dashboard' },
  '/admin/dashboard/deals': { label: 'Deals', parent: '/admin/dashboard' },
  '/admin/dashboard/users': { label: 'Users', parent: '/admin/dashboard' },
  '/admin/dashboard/businesses': {
    label: 'Businesses',
    parent: '/admin/dashboard',
  },
  '/admin/dashboard/content': { label: 'Content', parent: '/admin/dashboard' },
  '/admin/dashboard/content/categories': {
    label: 'Categories',
    parent: '/admin/dashboard/content',
  },
  '/admin/dashboard/content/locations': {
    label: 'Locations',
    parent: '/admin/dashboard/content',
  },
  '/admin/dashboard/content/treatments': {
    label: 'Treatments',
    parent: '/admin/dashboard/content',
  },
  '/admin/dashboard/reports': { label: 'Reports', parent: '/admin/dashboard' },
  '/admin/dashboard/monetization': {
    label: 'Monetization',
    parent: '/admin/dashboard',
  },
  '/admin/dashboard/data': { label: 'Data', parent: '/admin/dashboard' },
  '/admin/dashboard/settings': {
    label: 'Settings',
    parent: '/admin/dashboard',
  },
}

export interface Breadcrumb {
  label: string
  href: string
  isCurrentPage: boolean
}

/**
 * Build breadcrumb trail from pathname
 * Handles dynamic routes by finding closest static match
 */
export function getBreadcrumbs(pathname: string): Breadcrumb[] {
  const breadcrumbs: Breadcrumb[] = []
  let currentPath = pathname

  // Handle dynamic routes by finding closest static match
  // e.g., /business/dashboard/deals/abc123/edit → /business/dashboard/deals
  while (currentPath && !routeConfig[currentPath]) {
    // Try removing last segment
    const segments = currentPath.split('/')
    segments.pop()
    currentPath = segments.join('/') || '/'
    if (currentPath === '/') break
  }

  // Build breadcrumb chain from current to root
  let path: string | undefined = currentPath
  while (path && routeConfig[path]) {
    breadcrumbs.unshift({
      label: routeConfig[path].label,
      href: path,
      isCurrentPage: path === currentPath,
    })
    path = routeConfig[path].parent
  }

  return breadcrumbs
}
