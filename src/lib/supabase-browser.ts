import { createBrowserClient } from '@supabase/ssr'
import { assertSupabaseEnv } from '@/lib/env'

/**
 * The signed-in client for client components. One per tab: in a browser @supabase/ssr's
 * createBrowserClient() returns a module-cached instance, so every caller (the three auth
 * contexts, notifications, the message thread, /auth/complete) shares one GoTrueClient and one
 * auth lock. During SSR it returns a fresh instance per call, so nothing is shared between
 * requests. Do not pass `isSingleton: false`, and do not construct a second client with
 * supabase-js's createClient() in client code — see src/lib/supabase.ts for what that cost.
 */
export function createSupabaseBrowserClient() {
  const { url, anonKey } = assertSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )
  return createBrowserClient(url, anonKey)
}
