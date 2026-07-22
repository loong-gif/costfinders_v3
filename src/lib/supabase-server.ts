import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabasePublishableKey } from './supabase-config'

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublishableKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Ignore errors in Server Components (read-only context)
          }
        },
      },
    },
  )
}
