import type { Admin } from '@/types/admin'

export const admins: Admin[] = [
  {
    id: 'admin-001',
    email: 'admin@costfinders.com',
    firstName: 'Sarah',
    lastName: 'Mitchell',
    role: 'super_admin',
    permissions: [
      'manage_users',
      'manage_businesses',
      'manage_deals',
      'manage_content',
      'manage_admins',
      'view_analytics',
      'manage_settings',
    ],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    lastLoginAt: '2024-12-15T10:30:00Z',
  },
  {
    id: 'admin-002',
    email: 'moderator@costfinders.com',
    firstName: 'James',
    lastName: 'Chen',
    role: 'moderator',
    permissions: [
      'manage_businesses',
      'manage_deals',
      'manage_content',
      'view_analytics',
    ],
    createdAt: '2024-03-15T00:00:00Z',
    updatedAt: '2024-03-15T00:00:00Z',
    lastLoginAt: '2024-12-14T16:45:00Z',
  },
  {
    id: 'admin-003',
    email: 'support@costfinders.com',
    firstName: 'Emily',
    lastName: 'Rodriguez',
    role: 'support',
    permissions: ['manage_users', 'view_analytics'],
    createdAt: '2024-06-01T00:00:00Z',
    updatedAt: '2024-06-01T00:00:00Z',
  },
]
