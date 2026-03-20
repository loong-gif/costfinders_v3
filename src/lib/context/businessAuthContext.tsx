'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import type { BusinessOwner, BusinessClaimStatus, BusinessVerificationStatus } from '@/types/businessOwner'
import { businessOwners } from '@/lib/mock-data/businessOwners'

const STORAGE_KEY = 'costfinders_business_auth'
const MOCK_NETWORK_DELAY_MS = 500

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

function getInitialState(): BusinessAuthState {
  return {
    owner: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  }
}

function loadStoredOwner(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const data = JSON.parse(stored) as { ownerId: string }
    return data.ownerId
  } catch {
    return null
  }
}

function saveOwnerId(ownerId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId }))
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

// Mock-only: tracks sign-ups during session. Replaced by Supabase queries in production.
let dynamicOwners: BusinessOwner[] = []

function findOwnerByEmail(email: string): BusinessOwner | undefined {
  const normalizedEmail = email.toLowerCase()
  // Check pre-seeded owners first, then dynamic ones
  return (
    businessOwners.find((o) => o.email.toLowerCase() === normalizedEmail) ||
    dynamicOwners.find((o) => o.email.toLowerCase() === normalizedEmail)
  )
}

function findOwnerById(ownerId: string): BusinessOwner | undefined {
  // Check pre-seeded owners first, then dynamic ones
  return (
    businessOwners.find((o) => o.id === ownerId) ||
    dynamicOwners.find((o) => o.id === ownerId)
  )
}

export function BusinessAuthProvider({
  children,
}: { children: React.ReactNode }) {
  const [state, setState] = useState<BusinessAuthState>(getInitialState)

  // Load stored owner on mount
  useEffect(() => {
    const ownerId = loadStoredOwner()
    if (ownerId) {
      const owner = findOwnerById(ownerId)
      if (owner) {
        setState({
          owner,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        return
      }
    }
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      password: string,
      firstName?: string,
      lastName?: string,
    ): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS))

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Please enter a valid email address',
        }))
        throw new Error('Please enter a valid email address')
      }

      // Check if email already exists
      const existingOwner = findOwnerByEmail(email)
      if (existingOwner) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'An account with this email already exists',
        }))
        throw new Error('An account with this email already exists')
      }

      // Create new mock business owner
      const now = new Date().toISOString()
      const newOwner: BusinessOwner = {
        id: `owner-${Date.now()}`,
        email: email.toLowerCase(),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        verificationStatus: 'unverified',
        claimStatus: 'none',
        createdAt: now,
        updatedAt: now,
      }

      // Add to dynamic owners
      dynamicOwners.push(newOwner)

      // Update state and persist
      setState({
        owner: newOwner,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      saveOwnerId(newOwner.id)
    },
    [],
  )

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, MOCK_NETWORK_DELAY_MS))

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(email)) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'Please enter a valid email address',
        }))
        throw new Error('Please enter a valid email address')
      }

      // Find owner by email (mock auth - no password check)
      const owner = findOwnerByEmail(email)
      if (!owner) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'No business account found with this email',
        }))
        throw new Error('No business account found with this email')
      }

      // Update timestamps
      const updatedOwner: BusinessOwner = {
        ...owner,
        updatedAt: new Date().toISOString(),
      }

      // Update in dynamic owners
      const ownerIndex = dynamicOwners.findIndex((o) => o.id === owner.id)
      if (ownerIndex !== -1) {
        dynamicOwners[ownerIndex] = updatedOwner
      }

      setState({
        owner: updatedOwner,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      saveOwnerId(updatedOwner.id)
    },
    [],
  )

  const signOut = useCallback(() => {
    setState({
      owner: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    clearStoredAuth()
  }, [])

  const updateVerificationStatus = useCallback(
    (status: BusinessVerificationStatus) => {
      setState((prev) => {
        if (!prev.owner) return prev

        const now = new Date().toISOString()
        const updatedOwner: BusinessOwner = {
          ...prev.owner,
          verificationStatus: status,
          updatedAt: now,
        }

        // Update in dynamic owners
        const ownerIndex = dynamicOwners.findIndex(
          (o) => o.id === updatedOwner.id,
        )
        if (ownerIndex !== -1) {
          dynamicOwners[ownerIndex] = updatedOwner
        }

        return {
          ...prev,
          owner: updatedOwner,
        }
      })
    },
    [],
  )

  const updateClaimStatus = useCallback((status: BusinessClaimStatus) => {
    setState((prev) => {
      if (!prev.owner) return prev

      const now = new Date().toISOString()
      const updatedOwner: BusinessOwner = {
        ...prev.owner,
        claimStatus: status,
        updatedAt: now,
      }

      // Update in dynamic owners
      const ownerIndex = dynamicOwners.findIndex(
        (o) => o.id === updatedOwner.id,
      )
      if (ownerIndex !== -1) {
        dynamicOwners[ownerIndex] = updatedOwner
      }

      return {
        ...prev,
        owner: updatedOwner,
      }
    })
  }, [])

  const linkBusiness = useCallback((businessId: string) => {
    setState((prev) => {
      if (!prev.owner) return prev

      const now = new Date().toISOString()
      const updatedOwner: BusinessOwner = {
        ...prev.owner,
        businessId,
        claimStatus: 'approved',
        verificationStatus: 'verified',
        updatedAt: now,
      }

      // Update in dynamic owners
      const ownerIndex = dynamicOwners.findIndex(
        (o) => o.id === updatedOwner.id,
      )
      if (ownerIndex !== -1) {
        dynamicOwners[ownerIndex] = updatedOwner
      }

      return {
        ...prev,
        owner: updatedOwner,
      }
    })
  }, [])

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
