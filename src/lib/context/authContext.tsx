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
import { signInAction, signOutAction, signUpAction } from '@/lib/actions/auth'
import type { Profile } from '@/lib/actions/profile'
import {
  getProfileAction,
  updateAlertPrefsAction,
  updateProfileAction,
} from '@/lib/actions/profile'
import {
  getSavedDealsAction,
  saveDealAction,
  unsaveDealAction,
} from '@/lib/actions/saved-deals'
import { trackEvent } from '@/lib/analytics'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { Consumer, VerificationStatus } from '@/types/consumer'

// ---------------------------------------------------------------------------
// Types (public interface — do not change)
// ---------------------------------------------------------------------------

interface AuthState {
  user: Consumer | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface ProfileUpdates {
  firstName?: string
  lastName?: string
  phone?: string
  locationCity?: string
  locationState?: string
}

interface AuthContextValue {
  state: AuthState
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  updateVerificationStatus: (status: VerificationStatus) => void
  verifyPhone: (phone: string) => void
  updateProfile: (updates: ProfileUpdates) => void
  updateAlertPreferences: (alertsEmail: boolean, alertsSms: boolean) => void
  savedDeals: string[]
  saveDeal: (dealId: string) => void
  unsaveDeal: (dealId: string) => void
  isDealSaved: (dealId: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Supabase profile row + auth email to the Consumer shape. */
function profileToConsumer(
  authId: string,
  email: string,
  emailConfirmedAt: string | null | undefined,
  profile: Profile,
): Consumer {
  return {
    id: authId,
    email,
    phone: profile.phone ?? undefined,
    firstName: profile.first_name ?? undefined,
    lastName: profile.last_name ?? undefined,
    avatarUrl: profile.avatar_url ?? undefined,
    verificationStatus: profile.verification_status as VerificationStatus,
    emailVerifiedAt: emailConfirmedAt ?? undefined,
    phoneVerifiedAt: profile.phone_verified_at ?? undefined,
    status: profile.status as 'active' | 'suspended',
    locationCity: profile.location_city ?? undefined,
    locationState: profile.location_state ?? undefined,
    alertsEmail: profile.alerts_email,
    alertsSms: profile.alerts_sms,
    favoriteCategories: profile.favorite_categories ?? [],
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
    lastLoginAt: profile.last_login_at ?? undefined,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })
  const [savedDeals, setSavedDeals] = useState<string[]>([])

  // Supabase browser client — stable across renders
  const supabaseRef = useRef(createSupabaseBrowserClient())

  // -------------------------------------------------------------------
  // Fetch profile + saved deals for an authenticated user
  // -------------------------------------------------------------------
  const hydrateUser = useCallback(async () => {
    const supabase = supabaseRef.current

    // Quick check: read session from local storage (no network request).
    // If no session exists, skip the expensive getUser() call entirely.
    // This saves 200-400ms for anonymous visitors (95% of traffic).
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      setSavedDeals([])
      return
    }

    // Session exists — validate with server and fetch profile
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser?.email) {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      setSavedDeals([])
      return
    }

    const [profileResult, dealsResult] = await Promise.all([
      getProfileAction(),
      getSavedDealsAction(),
    ])

    if (!profileResult.success || !profileResult.profile) {
      // User exists in auth but has no profile row yet (e.g. trigger hasn't fired)
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    const consumer = profileToConsumer(
      authUser.id,
      authUser.email,
      authUser.email_confirmed_at,
      profileResult.profile,
    )

    setState({
      user: consumer,
      isAuthenticated: true,
      isLoading: false,
      error: null,
    })

    if (dealsResult.success && dealsResult.deals) {
      setSavedDeals(dealsResult.deals.map((d) => String(d.deal_id)))
    }
  }, [])

  // -------------------------------------------------------------------
  // On mount: check for existing session + subscribe to auth changes
  // -------------------------------------------------------------------
  useEffect(() => {
    // Initial hydration
    hydrateUser()

    // Listen for auth state changes (sign in, sign out, token refresh)
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
  // signUp — calls server action, sets state to show email verification needed
  // -------------------------------------------------------------------
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const result = await signUpAction(email, password, firstName, lastName)

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error ?? 'Sign up failed',
        }))
        throw new Error(result.error ?? 'Sign up failed')
      }

      // If email verification is needed, don't sign in yet
      if (result.needsEmailVerification) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: null,
        }))
        return
      }

      // If auto-confirmed, hydrate user
      trackEvent('auth_signup')
      await hydrateUser()
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // signIn — calls server action, then hydrates user from session
  // -------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const result = await signInAction(email, password)

      if (!result.success) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: result.error ?? 'Sign in failed',
        }))
        throw new Error(result.error ?? 'Sign in failed')
      }

      // The onAuthStateChange listener will fire and hydrate the user,
      // but we also call hydrateUser explicitly for immediate feedback.
      trackEvent('auth_signin')
      await hydrateUser()
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // signOut — calls server action, clears state
  // -------------------------------------------------------------------
  const signOut = useCallback(() => {
    signOutAction().then(() => {
      setState({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      setSavedDeals([])
    })
  }, [])

  // -------------------------------------------------------------------
  // updateVerificationStatus — no-op (DB triggers handle this)
  // Kept for interface compatibility; refetches profile if called.
  // -------------------------------------------------------------------
  const updateVerificationStatus = useCallback(
    (_status: VerificationStatus) => {
      // Re-fetch profile to pick up any trigger-driven status changes
      hydrateUser()
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // verifyPhone — no-op for now (Twilio deferred)
  // -------------------------------------------------------------------
  const verifyPhone = useCallback((_phone: string) => {
    // No-op: phone verification via Twilio is deferred
  }, [])

  // -------------------------------------------------------------------
  // updateProfile — calls server action, updates local state
  // -------------------------------------------------------------------
  const updateProfile = useCallback(
    (updates: ProfileUpdates) => {
      if (!state.user) return

      // Map camelCase → snake_case for the server action
      const payload: Record<string, string> = {}
      if (updates.firstName !== undefined)
        payload.first_name = updates.firstName
      if (updates.lastName !== undefined) payload.last_name = updates.lastName
      if (updates.phone !== undefined) payload.phone = updates.phone
      if (updates.locationCity !== undefined)
        payload.location_city = updates.locationCity
      if (updates.locationState !== undefined)
        payload.location_state = updates.locationState

      // Optimistic local update
      setState((prev) => {
        if (!prev.user) return prev
        return {
          ...prev,
          user: {
            ...prev.user,
            ...updates,
            updatedAt: new Date().toISOString(),
          },
        }
      })

      // Fire server action (no await needed since interface is void)
      updateProfileAction(payload).then((result) => {
        if (!result.success) {
          // Revert on failure by re-fetching
          hydrateUser()
        }
      })
    },
    [state.user, hydrateUser],
  )

  // -------------------------------------------------------------------
  // updateAlertPreferences — calls server action
  // -------------------------------------------------------------------
  const updateAlertPreferences = useCallback(
    (alertsEmail: boolean, alertsSms: boolean) => {
      if (!state.user) return

      // Optimistic local update
      setState((prev) => {
        if (!prev.user) return prev
        return {
          ...prev,
          user: {
            ...prev.user,
            alertsEmail,
            alertsSms,
            updatedAt: new Date().toISOString(),
          },
        }
      })

      updateAlertPrefsAction(alertsEmail, alertsSms).then((result) => {
        if (!result.success) {
          hydrateUser()
        }
      })
    },
    [state.user, hydrateUser],
  )

  // -------------------------------------------------------------------
  // Saved deals
  // -------------------------------------------------------------------
  const saveDeal = useCallback((dealId: string) => {
    // Optimistic update
    setSavedDeals((prev) => {
      if (prev.includes(dealId)) return prev
      return [...prev, dealId]
    })

    // Fire server action — deal_id is bigint in DB
    saveDealAction(Number(dealId)).then((result) => {
      if (!result.success) {
        // Revert on failure
        setSavedDeals((prev) => prev.filter((id) => id !== dealId))
      }
    })
  }, [])

  const unsaveDeal = useCallback((dealId: string) => {
    // Optimistic update
    setSavedDeals((prev) => prev.filter((id) => id !== dealId))

    unsaveDealAction(Number(dealId)).then((result) => {
      if (!result.success) {
        // Revert on failure
        setSavedDeals((prev) => [...prev, dealId])
      }
    })
  }, [])

  const isDealSaved = useCallback(
    (dealId: string) => savedDeals.includes(dealId),
    [savedDeals],
  )

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      signUp,
      signIn,
      signOut,
      updateVerificationStatus,
      verifyPhone,
      updateProfile,
      updateAlertPreferences,
      savedDeals,
      saveDeal,
      unsaveDeal,
      isDealSaved,
    }),
    [
      state,
      signUp,
      signIn,
      signOut,
      updateVerificationStatus,
      verifyPhone,
      updateProfile,
      updateAlertPreferences,
      savedDeals,
      saveDeal,
      unsaveDeal,
      isDealSaved,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

/** Returns null when rendered outside AuthProvider (e.g. public SEO pages). */
export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext)
}
