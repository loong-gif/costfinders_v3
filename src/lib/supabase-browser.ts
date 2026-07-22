import { createBrowserClient } from '@supabase/ssr'
import { supabasePublishableKey } from './supabase-config'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabasePublishableKey,
  )
}
