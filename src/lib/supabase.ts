import { createClient } from '@supabase/supabase-js'
import { assertSupabaseEnv } from '@/lib/env'
import { retryingFetch } from '@/lib/retryingFetch'

const { url, anonKey } = assertSupabaseEnv(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

/**
 * The anonymous client for public reads (offers, businesses). Never holds a user session.
 *
 * Auth is switched off because this module also ships to the browser: client components
 * import getDealById() from src/lib/data/unified.ts. With the defaults it became a SECOND
 * GoTrueClient on the same storage key as the cookie-based client in supabase-browser.ts, so
 * every data query queued on the same `lock:sb-<ref>-auth-token` Web Lock as sign-in. The
 * customer dashboard fired one getDealById per claim and saved deal, the lock timed out at
 * 5s, auth-js stole it, and the loser threw "Lock broken by another request with the 'steal'
 * option". It also shared the auth BroadcastChannel, so its own startup could send SIGNED_OUT
 * events into the real client's listeners.
 *
 * persistSession:false gives it memory storage, a no-op lock and no BroadcastChannel; the
 * separate storageKey stops the "Multiple GoTrueClient instances" warning. Its reads were
 * already anonymous (it never saw the cookie session), so no query changes behaviour. On the
 * server the module-level instance is shared across requests, which is safe for the same
 * reason: it has no session to leak.
 *
 * Its reads retry a dropped connection (retryingFetch): these are the ~900 reads `next build`
 * prerenders from, and one ECONNRESET failed a production deploy on 2026-09-29.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    storageKey: 'sb-public-anon',
  },
  global: { fetch: retryingFetch() },
})
