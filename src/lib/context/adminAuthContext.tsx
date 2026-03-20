'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { admins } from '@/lib/mock-data'
import type { Admin } from '@/types/admin'

const STORAGE_KEY = 'costfinders_admin_id'
const MOCK_NETWORK_DELAY_MS = 500

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

function getInitialState(): AdminAuthState {
  return {
    admin: null,
    isAuthenticated: false,
    isLoading: true,
    error: null,
  }
}

function loadStoredAdminId(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const data = JSON.parse(stored) as { adminId: string }
    return data.adminId
  } catch {
    return null
  }
}

function saveAdminId(adminId: string) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ adminId }))
}

function clearStoredAuth() {
  if (typeof window === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

function findAdminByEmail(email: string): Admin | undefined {
  const normalizedEmail = email.toLowerCase()
  return admins.find((a) => a.email.toLowerCase() === normalizedEmail)
}

function findAdminById(adminId: string): Admin | undefined {
  return admins.find((a) => a.id === adminId)
}

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>(getInitialState)

  // Load stored admin on mount
  useEffect(() => {
    const adminId = loadStoredAdminId()
    if (adminId) {
      const admin = findAdminById(adminId)
      if (admin) {
        setState({
          admin,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        return
      }
    }
    setState((prev) => ({ ...prev, isLoading: false }))
  }, [])

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

      // Find admin by email (mock auth - no password check)
      const admin = findAdminByEmail(email)
      if (!admin) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'No admin account found with this email',
        }))
        throw new Error('No admin account found with this email')
      }

      // Update lastLoginAt
      const updatedAdmin: Admin = {
        ...admin,
        lastLoginAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      setState({
        admin: updatedAdmin,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      })

      saveAdminId(updatedAdmin.id)
    },
    [],
  )

  const signOut = useCallback(() => {
    setState({
      admin: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
    clearStoredAuth()
  }, [])

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
