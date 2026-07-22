import { createClient } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabasePublishableKey } from './supabase-config'

// Keep route modules importable before local demo credentials are configured.
// Data-fetching routes render a setup notice before issuing a request in that case.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || 'https://local-demo.invalid'
const supabaseAnonKey = supabasePublishableKey || 'local-demo-anon-key'

const emptySupabaseFetch: typeof fetch = async () =>
  new Response(JSON.stringify([]), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  isSupabaseConfigured ? undefined : { global: { fetch: emptySupabaseFetch } },
)
