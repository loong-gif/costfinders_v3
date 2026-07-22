'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { adminSignInAction, adminSignOutAction } from '@/lib/actions/admin-auth'
import type { AdminProfile } from '@/lib/actions/admin-profile'
import { getAdminProfileAction } from '@/lib/actions/admin-profile'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Admin, AdminPermission, AdminRole } from '@/types/admin'

// ---------------------------------------------------------------------------
// Types (public interface — do not change)
// ---------------------------------------------------------------------------

interface AdminAuthState {
  admin: Admin | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface AdminAuthContextValue {
  state: AdminAuthState
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Supabase admin_profiles row + auth email to the Admin shape. */
function profileToAdmin(
  authId: string,
  email: string,
  profile: AdminProfile,
): Admin {
  return {
    id: authId,
    email,
    firstName: profile.first_name ?? '',
    lastName: profile.last_name ?? '',
    role: profile.role as AdminRole,
    permissions: (profile.permissions ?? []) as AdminPermission[],
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({
    admin: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  // Supabase browser client — stable across renders
  const supabaseRef = useRef(createSupabaseBrowserClient())

  // -------------------------------------------------------------------
  // Fetch admin profile for an authenticated user
  // -------------------------------------------------------------------
  const hydrateUser = useCallback(async () => {
    const supabase = supabaseRef.current

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser?.email) {
      setState({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    // Only hydrate if the user has an admin role
    const userRole = authUser.user_metadata?.role as string | undefined
    if (userRole !== 'admin') {
      setState({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    // Fetch admin profile from server action
    const profileResult = await getAdminProfileAction()

    if (!profileResult.success || !profileResult.profile) {
      // User exists in auth but has no admin_profiles row yet
      setState({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    const admin = profileToAdmin(
      authUser.id,
      authUser.email,
      profileResult.profile,
    )

    setState({
      admin,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })
  }, [])

  // -------------------------------------------------------------------
  // On mount: check for existing session + subscribe to auth changes
  // -------------------------------------------------------------------
  useEffect(() => {
    hydrateUser()

    const supabase = supabaseRef.current
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (
        event === 'SIGNED_IN' ||
        event === 'TOKEN_REFRESHED' ||
        event === 'SIGNED_OUT'
      ) {
        hydrateUser()
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [hydrateUser])

  // -------------------------------------------------------------------
  // signIn — calls server action, then hydrates user from session
  // -------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const result = await adminSignInAction(email, password)

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error ?? 'Sign in failed',
        }))
        throw new Error(result.error ?? 'Sign in failed')
      }

      await hydrateUser()
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // signOut — calls server action, clears state
  // -------------------------------------------------------------------
  const signOut = useCallback(() => {
    adminSignOutAction().then(() => {
      setState({
        admin: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
    })
  }, [])

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------
  const value = useMemo<AdminAuthContextValue>(
    () => ({
      state,
      signIn,
      signOut,
    }),
    [state, signIn, signOut],
  )

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext)
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider')
  }
  return context
}
