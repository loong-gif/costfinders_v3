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
import { signInAction, signUpAction } from '@/lib/actions/auth'
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
  /** True on first load AND while a sign-in/sign-up submit is in flight. */
  isLoading: boolean
  /**
   * False until the first session check has finished, then true for the life of the tab. Unlike
   * isLoading it never flips back during a submit, so it is the signal for "we don't know yet
   * whether this visitor is signed in" — render a neutral placeholder, not "Sign in".
   */
  isReady: boolean
  error: string | null
}

const SIGNED_OUT: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isReady: true,
  error: null,
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
    /** 18+ attestation. signUpAction re-checks it server-side and refuses without it. */
    ageAttested?: boolean,
    /** Where the confirmation link lands, e.g. the deal they signed up from. */
    next?: string,
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
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

/**
 * Shown when an action rejects outright instead of returning a result (offline,
 * Next rejecting the request). There is no server message to show, and silence
 * reads to the user as a screen that never finishes loading.
 */
const UNEXPECTED_ERROR = 'Something went wrong. Please try again.'

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
    ...SIGNED_OUT,
    isLoading: true,
    isReady: false,
  })
  const [savedDeals, setSavedDeals] = useState<string[]>([])

  // Supabase browser client — one per tab (see src/lib/supabase-browser.ts)
  const supabaseRef = useRef(createSupabaseBrowserClient())
  // The auth user id the current state was hydrated for (null = signed out), and whether the
  // first hydration has finished. The auth listener reads both to skip events that change
  // nothing — see the mount effect.
  const userIdRef = useRef<string | null>(null)
  const readyRef = useRef(false)

  // -------------------------------------------------------------------
  // Fetch profile + saved deals for an authenticated user
  // -------------------------------------------------------------------
  /**
   * Resolve the current session into app state. Returns whether it ended SIGNED IN.
   *
   * It does not throw, because its other two callers are the mount effect and the
   * onAuthStateChange listener, and a rejection there leaves every consumer rendering skeletons
   * forever. But "did not throw" is not "worked": every branch below can legitimately end signed
   * out — no session, no email on the auth user, no profile row yet (the handle_new_user trigger
   * has not fired), or an outright rejection. signIn/signUp need to tell those apart from success,
   * so the outcome is the return value rather than an exception.
   *
   * Without this, a sign-in whose getProfileAction() failed resolved successfully: signInForm
   * called onSuccess(), authModal saw user === null with isLoading === false and closed itself,
   * and the error message unmounted with the only component rendering it. The modal shut as though
   * the sign-in had worked while the UI stayed signed out — silence on exactly the path the
   * try/catch was added to fix.
   */
  const hydrateUser = useCallback(async (): Promise<boolean> => {
    const supabase = supabaseRef.current
    const signedOut = () => {
      userIdRef.current = null
      setState(SIGNED_OUT)
      setSavedDeals([])
      return false
    }

    try {
      // Quick check: read session from local storage (no network request).
      // If no session exists, skip the expensive getUser() call entirely.
      // This saves 200-400ms for anonymous visitors (95% of traffic).
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) return signedOut()

      // Session exists — validate with server and fetch profile
      const {
        data: { user: authUser },
      } = await supabase.auth.getUser()

      if (!authUser?.email) return signedOut()

      // Fetch profile from server action
      const profileResult = await getProfileAction()

      // User exists in auth but has no profile row yet (e.g. trigger hasn't fired)
      if (!profileResult.success || !profileResult.profile) return signedOut()

      const consumer = profileToConsumer(
        authUser.id,
        authUser.email,
        authUser.email_confirmed_at,
        profileResult.profile,
      )

      userIdRef.current = authUser.id
      setState({
        user: consumer,
        isAuthenticated: true,
        isLoading: false,
        isReady: true,
        error: null,
      })

      // Fetch saved deals
      const dealsResult = await getSavedDealsAction()
      if (dealsResult.success && dealsResult.deals) {
        setSavedDeals(dealsResult.deals.map((d) => String(d.deal_id)))
      }
      return true
    } catch {
      // isLoading starts true on mount, so a rejection here leaves every
      // consumer rendering skeletons forever. Keep whatever user we already
      // had — a failed refresh is not a sign-out — and say something.
      setState((prev) => ({
        ...prev,
        isLoading: false,
        isReady: true,
        error: UNEXPECTED_ERROR,
      }))
      return false
    } finally {
      readyRef.current = true
    }
  }, [])

  // -------------------------------------------------------------------
  // On mount: check for existing session + subscribe to auth changes
  // -------------------------------------------------------------------
  useEffect(() => {
    // Initial hydration
    hydrateUser()

    // Listen for auth state changes from outside this provider: another tab signing in or out,
    // a session expiring, another context on the shared client calling signOut().
    //
    // Only an event that changes WHO is signed in re-hydrates. auth-js re-emits SIGNED_IN every
    // time the tab regains focus and TOKEN_REFRESHED about hourly; each used to cost a getUser()
    // (holding the auth lock over a network call), a profile fetch and a saved-deals fetch, and
    // re-rendered every consumer of this context. Events before the first hydration finishes are
    // ignored too — that hydration awaits auth-js's own initialisation, so it already sees them.
    //
    // Deferred with setTimeout because the callback runs while auth-js may hold its lock, and
    // Supabase warns against calling back into the client from inside it.
    const supabase = supabaseRef.current
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event !== 'SIGNED_IN' &&
        event !== 'TOKEN_REFRESHED' &&
        event !== 'SIGNED_OUT'
      ) {
        return
      }
      const eventUserId =
        event === 'SIGNED_OUT' ? null : (session?.user.id ?? null)
      setTimeout(() => {
        if (readyRef.current && eventUserId !== userIdRef.current) {
          hydrateUser()
        }
      }, 0)
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
      ageAttested?: boolean,
      next?: string,
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await signUpAction(
          email,
          password,
          firstName,
          lastName,
          ageAttested,
          next,
        )

        if (!result.success) {
          setState((prev) => ({
            ...prev,
            error: result.error ?? 'Sign up failed',
          }))
          throw new Error(result.error ?? 'Sign up failed')
        }

        // If email verification is needed, don't sign in yet
        if (result.needsEmailVerification) return

        // If auto-confirmed, hydrate user. hydrateUser() sets the signed-in
        // state itself and the finally below only flips isLoading after it has
        // resolved, so there is no flash of signed-out UI.
        //
        // It resolves rather than throws even when it ends signed out, so the boolean is the only
        // failure signal. Without this check the account is created, hydration fails, and
        // signUpForm still calls onSuccess() and shows the Verify Email view over a signed-out app.
        trackEvent('auth_signup')
        if (!(await hydrateUser())) {
          throw new Error(UNEXPECTED_ERROR)
        }
      } catch (err) {
        // Keep the message the failure branch above already set; only an
        // outright rejection reaches here with error still null.
        setState((prev) => ({ ...prev, error: prev.error || UNEXPECTED_ERROR }))
        throw err // signUpForm relies on this to skip onSuccess
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // signIn — calls server action, then hydrates user from session
  // -------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      try {
        const result = await signInAction(email, password)

        if (!result.success) {
          setState((prev) => ({
            ...prev,
            error: result.error ?? 'Sign in failed',
          }))
          throw new Error(result.error ?? 'Sign in failed')
        }

        // The onAuthStateChange listener will fire and hydrate the user,
        // but we also call hydrateUser explicitly for immediate feedback.
        // The finally below flips isLoading only after it resolves, so the
        // signed-in UI never flashes signed out.
        //
        // The boolean matters: signInAction can succeed while hydration ends signed out (no profile
        // row yet, or getProfileAction rejects). Resolving there made signInForm call onSuccess()
        // and authModal close itself over a signed-out app, taking the error message with it.
        trackEvent('auth_signin')
        if (!(await hydrateUser())) {
          throw new Error(UNEXPECTED_ERROR)
        }
      } catch (err) {
        setState((prev) => ({ ...prev, error: prev.error || UNEXPECTED_ERROR }))
        throw err // signInForm reads err.message to detect an unconfirmed email
      } finally {
        setState((prev) => ({ ...prev, isLoading: false }))
      }
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // signOut — through the shared browser client, then clears state
  // -------------------------------------------------------------------
  const signOut = useCallback(async () => {
    try {
      // The shared browser client does the whole sign-out in one call: it revokes the session
      // (global scope, as the old server action did), clears the auth cookies (they are not
      // httpOnly) and emits SIGNED_OUT to every listener on it, so the header and the business
      // context drop "Dashboard" at once. Through a server action the first press often looked
      // like it did nothing, and a failed action left the cookie live. An error here means the
      // session may still be live, so the UI stays signed in and says so.
      const { error } = await supabaseRef.current.auth.signOut()
      if (error) throw error
      userIdRef.current = null
      setState(SIGNED_OUT)
      setSavedDeals([])
    } catch {
      // The session may still be live, so don't render signed-out UI —
      // just stop loading and tell the user the sign-out didn't land.
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: UNEXPECTED_ERROR,
      }))
    }
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
      updateProfileAction(payload)
        .then((result) => {
          if (!result.success) {
            // Revert on failure by re-fetching
            hydrateUser()
          }
        })
        // Rejected outright — the optimistic edit above is unproven, so take
        // the same revert path rather than leaving it on screen as fact.
        .catch(() => hydrateUser())
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

      updateAlertPrefsAction(alertsEmail, alertsSms)
        .then((result) => {
          if (!result.success) {
            hydrateUser()
          }
        })
        .catch(() => hydrateUser())
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
    const revert = () =>
      setSavedDeals((prev) => prev.filter((id) => id !== dealId))
    saveDealAction(Number(dealId))
      .then((result) => {
        if (!result.success) {
          // Revert on failure
          revert()
        }
      })
      // Rejected outright — same revert, or the heart stays filled on a save
      // that never happened.
      .catch(revert)
  }, [])

  const unsaveDeal = useCallback((dealId: string) => {
    // Optimistic update
    setSavedDeals((prev) => prev.filter((id) => id !== dealId))

    const revert = () => setSavedDeals((prev) => [...prev, dealId])
    unsaveDealAction(Number(dealId))
      .then((result) => {
        if (!result.success) {
          // Revert on failure
          revert()
        }
      })
      .catch(revert)
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
