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
import {
  adminSignInAction,
  sendAdminMagicLinkAction,
} from '@/lib/actions/admin-auth'
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
  /**
   * Request a sign-in link. Resolves with the result instead of throwing, and never touches
   * `state.error`: the caller is still sitting on the login form with the password path
   * intact, so a failed send is not a failed sign-in. MagicLinkButton renders the outcome.
   */
  sendMagicLink: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>
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
  // signOut — through the shared browser client, then clears state
  // -------------------------------------------------------------------
  // Through the shared browser client, as in authContext's signOut: one call revokes the
  // session, clears the cookies and emits SIGNED_OUT to the header's contexts. The old server
  // action's result was ignored, so a failed sign-out still flipped this state, landed on
  // /admin, and /admin's own provider found the live session and sent the admin straight back.
  const signOut = useCallback(() => {
    supabaseRef.current.auth.signOut().then(({ error }) => {
      setState(
        error
          ? (prev) => ({
              ...prev,
              error: "We couldn't sign you out. Please try again.",
            })
          : {
              admin: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            },
      )
    })
  }, [])

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------
  const value = useMemo<AdminAuthContextValue>(
    () => ({
      state,
      signIn,
      // Passed straight through: a module-level server action is already a stable
      // reference, and there is no session state to hydrate until the emailed link is
      // followed — that lands on /auth/callback, in a fresh request.
      sendMagicLink: sendAdminMagicLinkAction,
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
