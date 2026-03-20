export type VerificationStatus =
  | 'unverified'
  | 'email_verified'
  | 'phone_verified'
  | 'fully_verified'

export type ConsumerStatus = 'active' | 'suspended'

export interface Consumer {
  id: string
  email: string
  phone?: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
  // Verification
  verificationStatus: VerificationStatus
  emailVerifiedAt?: string
  phoneVerifiedAt?: string
  // Account status
  status: ConsumerStatus
  // Preferences
  locationCity?: string
  locationState?: string
  alertsEmail: boolean
  alertsSms: boolean
  favoriteCategories: string[]
  // Timestamps
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}
