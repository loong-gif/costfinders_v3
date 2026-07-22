export function safeDashboardPath(value: string | null): string | null {
  if (value === '/dashboard' || value?.startsWith('/dashboard/')) return value
  return null
}
