const requiredVariables = ['NEXT_PUBLIC_SUPABASE_URL'] as const

export const supabasePublishableKey = (
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''
).trim()

export const missingSupabaseVariables = [
  ...requiredVariables.filter((variable) => !process.env[variable]?.trim()),
  ...(!supabasePublishableKey
    ? (['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] as const)
    : []),
]

export const isSupabaseConfigured = missingSupabaseVariables.length === 0
