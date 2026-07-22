import { createServerClient } from '@supabase/ssr'
import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase-config'

/** Routes requiring authentication (any role). */
const AUTH_REQUIRED_ROUTES = ['/dashboard']

/** Routes requiring a specific user_metadata.role. */
const ROLE_ROUTES: { prefix: string; role: string; fallback: string }[] = [
  { prefix: '/business/dashboard', role: 'business', fallback: '/business' },
  { prefix: '/admin/dashboard', role: 'admin', fallback: '/' },
]

export default async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!isSupabaseConfigured || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

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

  const { pathname } = request.nextUrl

  // --- Role-gated routes (check before generic auth) ---
  for (const route of ROLE_ROUTES) {
    if (pathname.startsWith(route.prefix)) {
      if (!user) {
        const url = request.nextUrl.clone()
        url.pathname = route.fallback
        url.searchParams.set('signin', 'required')
        return NextResponse.redirect(url)
      }
      const userRole = user.user_metadata?.role as string | undefined
      if (userRole !== route.role) {
        const url = request.nextUrl.clone()
        url.pathname = route.fallback
        return NextResponse.redirect(url)
      }
      return supabaseResponse
    }
  }

  // --- Generic auth-required routes ---
  const needsAuth = AUTH_REQUIRED_ROUTES.some((route) =>
    pathname.startsWith(route),
  )

  if (needsAuth && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('signin', 'required')
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
