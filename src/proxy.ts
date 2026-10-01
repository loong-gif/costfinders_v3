import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { assertSupabaseEnv } from '@/lib/env'

/** Routes requiring authentication (any role). */
const AUTH_REQUIRED_ROUTES = ['/dashboard']

/** Routes requiring a specific server-verified role. */
const ROLE_ROUTES: { prefix: string; role: string; fallback: string }[] = [
  { prefix: '/business/dashboard', role: 'business', fallback: '/business' },
  { prefix: '/admin/dashboard', role: 'admin', fallback: '/admin' },
]

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  // Read statically (not via process.env[name]) — Next inlines NEXT_PUBLIC_*
  // at build time, and a dynamic lookup would be undefined at runtime.
  //
  // Through assertSupabaseEnv rather than a local guard: it names the missing variable AND
  // trims the value. This proxy gates every authenticated route, so it must fail loudly on a
  // misconfigured deploy, and it must not be the one place a newlined env value survives.
  const { url: supabaseUrl, anonKey: supabaseAnonKey } = assertSupabaseEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  )

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value)
        }
        supabaseResponse = NextResponse.next({ request })
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options)
        }
      },
    },
  })

  // Refresh session if expired — important for server components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // A refreshed session exists ONLY on supabaseResponse's cookies: the setAll
  // callback above writes them there. NextResponse.redirect() starts with an
  // empty Set-Cookie header, so every redirect below has to carry them over —
  // otherwise the browser keeps the refresh token Supabase just rotated away and
  // the next request signs the user out. auth-js refreshes whenever the token is
  // within 90s of expiry, so any request in that window that also redirects loses
  // the rotation.
  //
  // Copies cookies only. supabaseResponse also carries the x-middleware-* headers,
  // which must not land on a redirect. Note ResponseCookies has no setAll() in
  // Next 16 (the Supabase docs snippet would throw); getAll() returns the same
  // ResponseCookie objects passed to set(), options included, so this is lossless.
  const redirectWithSession = (url: NextRequest['nextUrl']) => {
    const response = NextResponse.redirect(url)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      response.cookies.set(cookie)
    }
    return response
  }

  const { pathname } = request.nextUrl

  // --- Role-gated routes (check before generic auth) ---
  for (const route of ROLE_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = route.fallback
        url.searchParams.set('signin', 'required')
        return redirectWithSession(url)
      }
      // Admin is authorized against the admin_profiles table, never against
      // user_metadata — that field is client-writable at signup, so trusting it
      // would let anyone mint themselves an admin session.
      let authorized: boolean
      if (route.role === 'admin') {
        const { data: isAdmin } = await supabase.rpc('is_admin')
        authorized = isAdmin === true
      } else {
        // Business access is proved by a business_profiles row (id = auth.uid()),
        // written only by the handle_new_business_user trigger at signup. Not by
        // the role claim: any signed-in user can PUT one onto themselves.
        // Intentionally not filtered on claim_status — an unapproved owner still
        // needs the dashboard shell, which renders the claim-status screens.
        const { data: profile } = await supabase
          .from('business_profiles')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        authorized = profile !== null
      }

      if (!authorized) {
        const url = request.nextUrl.clone()
        url.pathname = route.fallback
        return redirectWithSession(url)
      }
      return supabaseResponse
    }
  }

  // --- Generic auth-required routes ---
  const needsAuth = AUTH_REQUIRED_ROUTES.some((route) =>
    pathname.startsWith(route),
  )

  if (needsAuth && !user) {
    // The homepage reads both params (SignInRequiredPrompt): it opens the sign-in modal and,
    // after sign-in, returns to `next`. The original query moves inside `next` rather than
    // riding along on the homepage URL. `next` is re-validated by safeNextPath() on arrival.
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    url.searchParams.set('signin', 'required')
    url.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return redirectWithSession(url)
  }

  return supabaseResponse
}
