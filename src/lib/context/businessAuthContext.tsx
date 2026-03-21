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
  businessSignOutAction,
  businessSignUpAction,
} from '@/lib/actions/business-auth'
import type { BusinessProfile } from '@/lib/actions/business-profile'
import {
  getBusinessProfileAction,
  linkBusinessAction,
  updateClaimStatusAction,
  updateVerificationStatusAction,
} from '@/lib/actions/business-profile'
import { createSupabaseBrowserClient } from '@/lib/supabase-browser'
import type {
  BusinessClaimStatus,
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
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => void
  updateVerificationStatus: (status: BusinessVerificationStatus) => void
  updateClaimStatus: (status: BusinessClaimStatus) => void
  linkBusiness: (businessId: string) => void
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

    // Only hydrate if the user has a business role
    const userRole = authUser.user_metadata?.role as string | undefined
    if (userRole !== 'business') {
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

    return () => {
      subscription.unsubscribe()
    }
  }, [hydrateUser])

  // -------------------------------------------------------------------
  // signUp — calls server action, sets state for email verification
  // -------------------------------------------------------------------
  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      const result = await businessSignUpAction(
        email,
        password,
        firstName,
        lastName,
      )

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
  // signOut — calls server action, clears state
  // -------------------------------------------------------------------
  const signOut = useCallback(() => {
    businessSignOutAction().then(() => {
      setState({
        owner: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
      })
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
  // updateClaimStatus — calls server action, optimistic update
  // -------------------------------------------------------------------
  const updateClaimStatus = useCallback(
    (status: BusinessClaimStatus) => {
      setState((prev) => {
        if (!prev.owner) return prev
        return {
          ...prev,
          owner: {
            ...prev.owner,
            claimStatus: status,
            updatedAt: new Date().toISOString(),
          },
        }
      })

      updateClaimStatusAction(status).then((result) => {
        if (!result.success) {
          hydrateUser()
        }
      })
    },
    [hydrateUser],
  )

  // -------------------------------------------------------------------
  // linkBusiness — calls server action, optimistic update
  // -------------------------------------------------------------------
  const linkBusiness = useCallback(
    (businessId: string) => {
      setState((prev) => {
        if (!prev.owner) return prev
        return {
          ...prev,
          owner: {
            ...prev.owner,
            businessId,
            claimStatus: 'pending' as BusinessClaimStatus,
            updatedAt: new Date().toISOString(),
          },
        }
      })

      linkBusinessAction(Number(businessId)).then((result) => {
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
      signUp,
      signIn,
      signOut,
      updateVerificationStatus,
      updateClaimStatus,
      linkBusiness,
    }),
    [
      state,
      signUp,
      signIn,
      signOut,
      updateVerificationStatus,
      updateClaimStatus,
      linkBusiness,
    ],
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
