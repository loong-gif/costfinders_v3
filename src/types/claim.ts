export type ClaimStatus =
  | 'pending'
  | 'contacted'
  | 'booked'
  | 'completed'
  | 'cancelled'
  | 'expired'

export interface Claim {
  id: string
  dealId: string
  consumerId: string
  businessId: string
  status: ClaimStatus
  // Request details
  preferredDate?: string
  preferredTime?: string
  notes?: string
  // Response
  respondedAt?: string
  // Booking
  bookedDate?: string
  bookedTime?: string
  // Timestamps
  createdAt: string
  updatedAt: string
  expiresAt: string // claims expire if not responded to
  // What the claim revealed. Kept on the claim so it outlives the listing.
  dealTitle?: string
  priceLabel?: string
  clinic?: ClaimClinic
  /** False when the deal has since been taken down; undefined when that could not be checked. */
  dealVisible?: boolean
}

/**
 * The clinic a claim revealed. Same keys as `claims.business_snapshot` (jsonb), which
 * trg_claims_keep_revealed_details copies from master_business_info at insert.
 */
export interface ClaimClinic {
  name: string
  address: string | null
  city: string | null
  phone: string | null
  website: string | null
  rating: number | null
  review_count: number | null
  google_place_id: string | null
}
