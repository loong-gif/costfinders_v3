'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { consumers } from '@/lib/mock-data/consumers'
import type { Consumer, VerificationStatus } from '@/types/consumer'

const STORAGE_KEY = 'costfinders_auth'
const SAVED_DEALS_KEY = 'costfinders_saved_deals'
const MOCK_NETWORK_DELAY_MS = 500

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

function getInitialState(): AuthState {
  return {
    user: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  }
}

function loadStoredUser(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const data = JSON.parse(stored) as { userId: string }
    return data.userId
  } catch {
    return null
  }
}

function saveUserId(userId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ userId }))
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

function loadSavedDeals(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(SAVED_DEALS_KEY)
    if (!stored) return []
    return JSON.parse(stored) as string[]
  } catch {
    return []
  }
}

function saveSavedDeals(deals: string[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(SAVED_DEALS_KEY, JSON.stringify(deals))
}

// Mock-only: tracks sign-ups during session. Replaced by Supabase queries in production.
const dynamicUsers: Consumer[] = []

function findUserByEmail(email: string): Consumer | undefined {
  const normalizedEmail = email.toLowerCase()
  return (
    consumers.find((c) => c.email.toLowerCase() === normalizedEmail) ||
    dynamicUsers.find((c) => c.email.toLowerCase() === normalizedEmail)
  )
}

function findUserById(userId: string): Consumer | undefined {
  return (
    consumers.find((c) => c.id === userId) ||
    dynamicUsers.find((c) => c.id === userId)
  )
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(getInitialState)
  const [savedDeals, setSavedDeals] = useState<string[]>([])

  // Load stored user on mount
  useEffect(() => {
    const userId = loadStoredUser()
    if (userId) {
      const user = findUserById(userId)
      if (user) {
        setState({
          user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        // Load saved deals for authenticated user
        setSavedDeals(loadSavedDeals())
        return
      }
    }
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

  const signUp = useCallback(
    async (
      email: string,
      _password: string,
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
      const existingUser = findUserByEmail(email)
      if (existingUser) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'An account with this email already exists',
        }))
        throw new Error('An account with this email already exists')
      }

      // Create new mock user
      const now = new Date().toISOString()
      const newUser: Consumer = {
        id: `user-${Date.now()}`,
        email: email.toLowerCase(),
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        verificationStatus: 'unverified',
        status: 'active',
        alertsEmail: false,
        alertsSms: false,
        favoriteCategories: [],
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
      }

      // Add to dynamic users
      dynamicUsers.push(newUser)

      // Update state and persist
      setState({
        user: newUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      saveUserId(newUser.id)
    },
    [],
  )

  const signIn = useCallback(
    async (email: string, _password: string): Promise<void> => {
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

      // Find user by email (mock auth - no password check)
      const user = findUserByEmail(email)
      if (!user) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'No account found with this email',
        }))
        throw new Error('No account found with this email')
      }

      // Update last login
      const updatedUser: Consumer = {
        ...user,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Update in dynamic users if needed
      const dynamicIndex = dynamicUsers.findIndex((u) => u.id === user.id)
      if (dynamicIndex !== -1) {
        dynamicUsers[dynamicIndex] = updatedUser
      }

      setState({
        user: updatedUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      saveUserId(updatedUser.id)
    },
    [],
  )

  const signOut = useCallback(() => {
    setState({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    clearStoredAuth()
  }, [])

  const updateVerificationStatus = useCallback((status: VerificationStatus) => {
    setState((prev) => {
      if (!prev.user) return prev

      const now = new Date().toISOString()
      const updatedUser: Consumer = {
        ...prev.user,
        verificationStatus: status,
        updatedAt: now,
        ...(status === 'email_verified' || status === 'fully_verified'
          ? { emailVerifiedAt: now }
          : {}),
        ...(status === 'phone_verified' || status === 'fully_verified'
          ? { phoneVerifiedAt: now }
          : {}),
      }

      // Update in dynamic users if needed
      const dynamicIndex = dynamicUsers.findIndex(
        (u) => u.id === updatedUser.id,
      )
      if (dynamicIndex !== -1) {
        dynamicUsers[dynamicIndex] = updatedUser
      }

      return {
        ...prev,
        user: updatedUser,
      }
    })
  }, [])

  const verifyPhone = useCallback((phone: string) => {
    setState((prev) => {
      if (!prev.user) return prev

      const now = new Date().toISOString()

      // Determine new verification status based on current status
      let newStatus: VerificationStatus
      if (prev.user.verificationStatus === 'email_verified') {
        newStatus = 'fully_verified'
      } else if (prev.user.verificationStatus === 'unverified') {
        newStatus = 'phone_verified'
      } else {
        // Already fully_verified or phone_verified, keep as is
        newStatus = prev.user.verificationStatus
      }

      const updatedUser: Consumer = {
        ...prev.user,
        phone,
        phoneVerifiedAt: now,
        verificationStatus: newStatus,
        updatedAt: now,
      }

      // Update in dynamic users if needed
      const dynamicIndex = dynamicUsers.findIndex(
        (u) => u.id === updatedUser.id,
      )
      if (dynamicIndex !== -1) {
        dynamicUsers[dynamicIndex] = updatedUser
      }

      // Persist to localStorage (userId is already stored, user data is in state)
      saveUserId(updatedUser.id)

      return {
        ...prev,
        user: updatedUser,
      }
    })
  }, [])

  const updateProfile = useCallback((updates: ProfileUpdates) => {
    setState((prev) => {
      if (!prev.user) return prev

      const now = new Date().toISOString()

      // Only allow specific fields to be updated
      const allowedUpdates: Partial<Consumer> = {}
      if (updates.firstName !== undefined)
        allowedUpdates.firstName = updates.firstName
      if (updates.lastName !== undefined)
        allowedUpdates.lastName = updates.lastName
      if (updates.phone !== undefined) allowedUpdates.phone = updates.phone
      if (updates.locationCity !== undefined)
        allowedUpdates.locationCity = updates.locationCity
      if (updates.locationState !== undefined)
        allowedUpdates.locationState = updates.locationState

      const updatedUser: Consumer = {
        ...prev.user,
        ...allowedUpdates,
        updatedAt: now,
      }

      // Update in dynamic users if needed
      const dynamicIndex = dynamicUsers.findIndex(
        (u) => u.id === updatedUser.id,
      )
      if (dynamicIndex !== -1) {
        dynamicUsers[dynamicIndex] = updatedUser
      }

      return {
        ...prev,
        user: updatedUser,
      }
    })
  }, [])

  const updateAlertPreferences = useCallback(
    (alertsEmail: boolean, alertsSms: boolean) => {
      setState((prev) => {
        if (!prev.user) return prev

        const now = new Date().toISOString()

        const updatedUser: Consumer = {
          ...prev.user,
          alertsEmail,
          alertsSms,
          updatedAt: now,
        }

        // Update in dynamic users if needed
        const dynamicIndex = dynamicUsers.findIndex(
          (u) => u.id === updatedUser.id,
        )
        if (dynamicIndex !== -1) {
          dynamicUsers[dynamicIndex] = updatedUser
        }

        return {
          ...prev,
          user: updatedUser,
        }
      })
    },
    [],
  )

  const saveDeal = useCallback((dealId: string) => {
    setSavedDeals((prev) => {
      if (prev.includes(dealId)) return prev
      const updated = [...prev, dealId]
      saveSavedDeals(updated)
      return updated
    })
  }, [])

  const unsaveDeal = useCallback((dealId: string) => {
    setSavedDeals((prev) => {
      const updated = prev.filter((id) => id !== dealId)
      saveSavedDeals(updated)
      return updated
    })
  }, [])

  const isDealSaved = useCallback(
    (dealId: string) => savedDeals.includes(dealId),
    [savedDeals],
  )

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
