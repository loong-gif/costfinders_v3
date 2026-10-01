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
  businessSignInAction,
  sendBusinessMagicLinkAction,
} from '@/lib/actions/business-auth'
import type { BusinessProfile } from '@/lib/actions/business-profile'
import {
  getBusinessProfileAction,
  updateVerificationStatusAction,
} from '@/lib/actions/business-profile'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type {
  BusinessOwner,
  BusinessVerificationStatus,
} from '@/types/businessOwner'

// ---------------------------------------------------------------------------
// Types (public interface — do not change)
// ---------------------------------------------------------------------------

interface BusinessAuthState {
  owner: BusinessOwner | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null
}

interface BusinessAuthContextValue {
  state: BusinessAuthState
  // No signUp: business onboarding is closed at launch. Existing owners sign in (password or
  // magic link); new owner accounts are not created from the app.
  signIn: (email: string, password: string) => Promise<void>
  /**
   * Request a sign-in link. Resolves with the result instead of throwing, and never touches
   * `state.error`: the caller is still sitting on the sign-in form with the password path
   * intact, so a failed send is not a failed sign-in. MagicLinkButton renders the outcome.
   */
  sendMagicLink: (
    email: string,
  ) => Promise<{ success: boolean; error?: string }>
  signOut: () => void
  updateVerificationStatus: (status: BusinessVerificationStatus) => void
}

const BusinessAuthContext = createContext<BusinessAuthContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Supabase business_profiles row + auth email to the BusinessOwner shape. */
function profileToBusinessOwner(
  authId: string,
  email: string,
  profile: BusinessProfile,
): BusinessOwner {
  return {
    id: authId,
    email,
    firstName: profile.first_name ?? undefined,
    lastName: profile.last_name ?? undefined,
    phone: profile.phone ?? undefined,
    businessId: profile.business_id ? String(profile.business_id) : undefined,
    verificationStatus: profile.verification_status,
    claimStatus: profile.claim_status,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function BusinessAuthProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const [state, setState] = useState<BusinessAuthState>({
    owner: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  })

  // Supabase browser client — stable across renders
  const supabaseRef = useRef(createSupabaseBrowserClient())

  // -------------------------------------------------------------------
  // Fetch business profile for an authenticated user
  // -------------------------------------------------------------------
  const hydrateUser = useCallback(async () => {
    const supabase = supabaseRef.current

    // Quick check: skip network call for anonymous visitors
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) {
      setState({
        owner: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()

    if (!authUser?.email) {
      setState({
        owner: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    // Fetch business profile from server action
    const profileResult = await getBusinessProfileAction()

    if (!profileResult.success || !profileResult.profile) {
      // User exists in auth but has no business_profiles row yet
      setState({
        owner: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
      return
    }

    const owner = profileToBusinessOwner(
      authUser.id,
      authUser.email,
      profileResult.profile,
    )

    setState({
      owner,
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

    // Re-hydrate when tab becomes visible (e.g., after admin approves claim)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        hydrateUser()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [hydrateUser])

  // -------------------------------------------------------------------
  // signIn — calls server action, then hydrates user from session
  // -------------------------------------------------------------------
  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const result = await businessSignInAction(email, password)

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
  // session, clears the cookies and emits SIGNED_OUT to the header's consumer context too.
  const signOut = useCallback(() => {
    supabaseRef.current.auth.signOut().then(({ error }) => {
      setState(
        error
          ? (prev) => ({
              ...prev,
              error: "We couldn't sign you out. Please try again.",
            })
          : {
              owner: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            },
      )
    })
  }, [])

  // -------------------------------------------------------------------
  // updateVerificationStatus — calls server action, optimistic update
  // -------------------------------------------------------------------
  const updateVerificationStatus = useCallback(
    (status: BusinessVerificationStatus) => {
      setState((prev) => {
        if (!prev.owner) return prev
        return {
          ...prev,
          owner: {
            ...prev.owner,
            verificationStatus: status,
            updatedAt: new Date().toISOString(),
          },
        }
      })

      updateVerificationStatusAction(status).then((result) => {
        if (!result.success) {
          hydrateUser()
        }
      })
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------
  const value = useMemo<BusinessAuthContextValue>(
    () => ({
      state,
      signIn,
      // Passed straight through: a module-level server action is already a stable
      // reference, and there is no session state to hydrate until the emailed link is
      // followed — that lands on /auth/callback, in a fresh request.
      sendMagicLink: sendBusinessMagicLinkAction,
      signOut,
      updateVerificationStatus,
    }),
    [state, signIn, signOut, updateVerificationStatus],
  )

  return (
    <BusinessAuthContext.Provider value={value}>
      {children}
    </BusinessAuthContext.Provider>
  )
}

export function useBusinessAuth(): BusinessAuthContextValue {
  const context = useContext(BusinessAuthContext)
  if (!context) {
    throw new Error(
      'useBusinessAuth must be used within a BusinessAuthProvider',
    )
  }
  return context
}
