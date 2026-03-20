export type TreatmentCategory =
  | 'botox'
  | 'fillers'
  | 'facials'
  | 'laser'
  | 'body'
  | 'skincare'

export type ModerationStatus =
  | 'pending_review'
  | 'approved'
  | 'rejected'
  | 'changes_requested'

export interface Deal {
  id: string
  businessId: string
  title: string
  description: string
  category: TreatmentCategory
  originalPrice: number
  dealPrice: number
  discountPercent: number
  unit: string // e.g., "per unit", "per session", "per area"
  minUnits?: number
  maxUnits?: number
  validFrom: string // ISO date
  validUntil: string // ISO date
  termsAndConditions: string
  imageUrl?: string
  isActive: boolean
  isFeatured: boolean
  isSponsored: boolean
  claimCount: number
  viewCount: number
  createdAt: string
  updatedAt: string
  // Moderation fields (optional for backward compatibility)
  moderationStatus?: ModerationStatus
  moderationNotes?: string
}

// What consumers see before verification
export type TemplateType = 'FIXED_PRICE' | 'DISCOUNT' | 'BUNDLE' | 'MEMBERSHIP' | 'COMPLIMENTARY'

export interface AnonymousDeal extends Omit<Deal, 'businessId'> {
  locationArea: string // e.g., "Downtown Austin"
  businessRating: number
  businessReviewCount: number
  businessTier: 'unclaimed' | 'free' | 'paid'
  templateType: TemplateType
}
