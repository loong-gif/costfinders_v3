/**
 * One admin role. Membership in admin_profiles IS the privilege — that is what
 * public.is_admin() checks and what every RLS policy on the project relies on.
 * The previous 'super_admin' | 'moderator' | 'support' tiers were never
 * distinguished by any policy or any server-side gate. See migration
 * 20260903000010_single_admin_role.sql.
 */
export type AdminRole = 'admin'

export type AdminPermission =
  | 'manage_users'
  | 'manage_businesses'
  | 'manage_deals'
  | 'manage_content'
  | 'manage_admins'
  | 'view_analytics'
  | 'manage_settings'

export interface Admin {
  id: string
  email: string
  firstName: string
  lastName: string
  role: AdminRole
  permissions: AdminPermission[]
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}
