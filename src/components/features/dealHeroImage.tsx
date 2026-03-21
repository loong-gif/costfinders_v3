'use client'

import { BlurredImage } from '@/components/patterns/blurredImage'
import { useClaims } from '@/lib/context/claimsContext'

interface DealHeroImageProps {
  dealId: string
  src: string | null | undefined
  alt: string
}

export function DealHeroImage({ dealId, src, alt }: DealHeroImageProps) {
  const { getClaimByDealId } = useClaims()
  const hasClaim = !!getClaimByDealId(dealId)

  return (
    <BlurredImage
      src={src}
      alt={alt}
      sizes="(max-width: 1024px) 100vw, 66vw"
      unlocked={hasClaim}
    />
  )
}
