'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { ClaimRow } from '@/lib/actions/claims'
import { createClaimAction, getClaimsAction } from '@/lib/actions/claims'
import type { Claim, ClaimStatus } from '@/types/claim'
import { useAuth } from './authContext'

// ---------------------------------------------------------------------------
// Types (public interface — do not change)
// ---------------------------------------------------------------------------

interface ClaimsState {
  claims: Claim[]
  isLoading: boolean
}

interface ClaimsContextValue {
  state: ClaimsState
  createClaim: (
    dealId: string,
    businessId: string,
    preferredDate?: string,
    preferredTime?: string,
    notes?: string,
  ) => Promise<Claim>
  refreshClaims: () => Promise<void>
  getClaim: (claimId: string) => Claim | undefined
  getClaimByDealId: (dealId: string) => Claim | undefined
  getClaimsByStatus: (status: ClaimStatus) => Claim[]
}

const ClaimsContext = createContext<ClaimsContextValue | null>(null)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Map a Supabase claims row (snake_case, numeric IDs) to the Claim type. */
function claimRowToClaim(row: ClaimRow): Claim {
  return {
    id: row.id,
    dealId: String(row.deal_id),
    businessId: String(row.business_id),
    consumerId: row.consumer_id,
    status: row.status,
    preferredDate: row.preferred_date ?? undefined,
    preferredTime: row.preferred_time ?? undefined,
    notes: row.notes ?? undefined,
    businessResponse: row.business_response ?? undefined,
    respondedAt: row.responded_at ?? undefined,
    bookedDate: row.booked_date ?? undefined,
    bookedTime: row.booked_time ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
  }
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ClaimsProvider({ children }: { children: React.ReactNode }) {
  const { state: authState } = useAuth()
  const [state, setState] = useState<ClaimsState>({
    claims: [],
    isLoading: true,
  })

  // Shared fetch function — used by effect and refreshClaims
  const fetchClaims = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }))
    const result = await getClaimsAction()
    if (result.success && result.claims) {
      setState({ claims: result.claims.map(claimRowToClaim), isLoading: false })
    } else {
      setState({ claims: [], isLoading: false })
    }
  }, [])

  // Fetch claims from Supabase when the user changes
  useEffect(() => {
    if (!authState.user) {
      setState({ claims: [], isLoading: false })
      return
    }

    let cancelled = false
    fetchClaims().then(() => {
      if (cancelled) return
    })
    return () => {
      cancelled = true
    }
  }, [authState.user, fetchClaims])

  /** Re-fetch claims from the server (call after external claim creation) */
  const refreshClaims = useCallback(async () => {
    if (!authState.user) return
    await fetchClaims()
  }, [authState.user, fetchClaims])

  // -------------------------------------------------------------------
  // createClaim — calls server action, adds to local state on success
  // -------------------------------------------------------------------
  const createClaim = useCallback(
    async (
      dealId: string,
      businessId: string,
      preferredDate?: string,
      preferredTime?: string,
      notes?: string,
    ): Promise<Claim> => {
      if (!authState.user) {
        throw new Error('Must be authenticated to create a claim')
      }

      const result = await createClaimAction(
        Number(dealId),
        Number(businessId),
        preferredDate,
        preferredTime,
        notes,
      )

      if (!result.success || !result.claimId) {
        throw new Error(result.error ?? 'Failed to create claim')
      }

      // Build the Claim object from what we know + the returned ID
      const now = new Date()
      const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)

      const newClaim: Claim = {
        id: result.claimId,
        dealId,
        businessId,
        consumerId: authState.user.id,
        status: 'pending',
        preferredDate,
        preferredTime,
        notes,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        expiresAt: expiresAt.toISOString(),
      }

      setState((prev) => ({
        ...prev,
        claims: [newClaim, ...prev.claims],
      }))

      return newClaim
    },
    [authState.user],
  )

  // -------------------------------------------------------------------
  // Read helpers — filter from local state
  // -------------------------------------------------------------------
  const getClaim = useCallback(
    (claimId: string): Claim | undefined => {
      return state.claims.find((c) => c.id === claimId)
    },
    [state.claims],
  )

  const getClaimByDealId = useCallback(
    (dealId: string): Claim | undefined => {
      return state.claims.find((c) => c.dealId === dealId)
    },
    [state.claims],
  )

  const getClaimsByStatus = useCallback(
    (status: ClaimStatus): Claim[] => {
      return state.claims.filter((c) => c.status === status)
    },
    [state.claims],
  )

  // -------------------------------------------------------------------
  // Context value
  // -------------------------------------------------------------------
  const value = useMemo<ClaimsContextValue>(
    () => ({
      state,
      createClaim,
      refreshClaims,
      getClaim,
      getClaimByDealId,
      getClaimsByStatus,
    }),
    [
      state,
      createClaim,
      refreshClaims,
      getClaim,
      getClaimByDealId,
      getClaimsByStatus,
    ],
  )

  return (
    <ClaimsContext.Provider value={value}>{children}</ClaimsContext.Provider>
  )
}

export function useClaims(): ClaimsContextValue {
  const context = useContext(ClaimsContext)
  if (!context) {
    throw new Error('useClaims must be used within a ClaimsProvider')
  }
  return context
}
