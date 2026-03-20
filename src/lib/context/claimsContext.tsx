'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { Claim, ClaimStatus } from '@/types/claim'
import { useAuth } from './authContext'

const STORAGE_KEY = 'costfinders_claims'
const CLAIM_EXPIRY_DAYS = 7

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
  ) => Claim
  getClaim: (claimId: string) => Claim | undefined
  getClaimByDealId: (dealId: string) => Claim | undefined
  getClaimsByStatus: (status: ClaimStatus) => Claim[]
}

const ClaimsContext = createContext<ClaimsContextValue | null>(null)

function loadStoredClaims(): Claim[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return []
    return JSON.parse(stored) as Claim[]
  } catch {
    return []
  }
}

function saveClaimsToStorage(claims: Claim[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(claims))
}

export function ClaimsProvider({ children }: { children: React.ReactNode }) {
  const { state: authState } = useAuth()
  const [state, setState] = useState<ClaimsState>({
    claims: [],
    isLoading: true,
  })

  // Load claims on mount and filter to current user
  useEffect(() => {
    const allClaims = loadStoredClaims()
    const userClaims = authState.user
      ? allClaims.filter((c) => c.consumerId === authState.user?.id)
      : []
    setState({
      claims: userClaims,
      isLoading: false,
    })
  }, [authState.user])

  const createClaim = useCallback(
    (
      dealId: string,
      businessId: string,
      preferredDate?: string,
      preferredTime?: string,
      notes?: string,
    ): Claim => {
      if (!authState.user) {
        throw new Error('Must be authenticated to create a claim')
      }

      const now = new Date()
      const expiresAt = new Date(
        now.getTime() + CLAIM_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      )

      const newClaim: Claim = {
        id: `claim-${Date.now()}`,
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

      // Update state
      setState((prev) => {
        const updatedClaims = [...prev.claims, newClaim]
        // Save all claims (including from other users) plus the new one
        const allClaims = loadStoredClaims()
        saveClaimsToStorage([...allClaims, newClaim])
        return {
          ...prev,
          claims: updatedClaims,
        }
      })

      return newClaim
    },
    [authState.user],
  )

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

  const value = useMemo<ClaimsContextValue>(
    () => ({
      state,
      createClaim,
      getClaim,
      getClaimByDealId,
      getClaimsByStatus,
    }),
    [state, createClaim, getClaim, getClaimByDealId, getClaimsByStatus],
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
