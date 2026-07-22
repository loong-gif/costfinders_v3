'use client'

import { Heart } from '@phosphor-icons/react'
import { Tooltip } from '@/components/ui/tooltip'
import { trackEvent } from '@/lib/analytics'
import { useOptionalAuth } from '@/lib/context/authContext'

interface SaveButtonProps {
  dealId: string
  size?: 'sm' | 'md'
  className?: string
}

export function SaveButton({
  dealId,
  size = 'sm',
  className = '',
}: SaveButtonProps) {
  const auth = useOptionalAuth()
  const isAuthenticated = auth?.state.isAuthenticated ?? false
  const saved = auth?.isDealSaved(dealId) ?? false

  const iconSize = size === 'sm' ? 20 : 24
  const buttonSize = size === 'sm' ? 'w-11 h-11' : 'w-11 h-11'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!auth || !isAuthenticated) return

    if (saved) {
      auth.unsaveDeal(dealId)
      trackEvent('deal_unsaved', { dealId })
    } else {
      auth.saveDeal(dealId)
      trackEvent('deal_saved', { dealId })
    }
  }

  const button = (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isAuthenticated}
      className={`
        ${buttonSize}
        flex items-center justify-center
        rounded-full
        bg-[#f2ebe2]/80
        border border-[#d4c4b0]
        transition-all duration-300
        ${
          isAuthenticated
            ? 'hover:bg-[#f2ebe2] hover:scale-110 active:scale-90 cursor-pointer'
            : 'cursor-not-allowed opacity-60'
        }
        ${saved ? 'text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.2)]' : 'text-[#78350f] hover:text-[#451a03]'}
        ${className}
      `}
      aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart
        size={iconSize}
        weight={saved ? 'fill' : 'regular'}
        className={`transition-transform duration-200 ${saved ? 'scale-110' : ''}`}
      />
    </button>
  )

  if (!isAuthenticated) {
    return (
      <Tooltip content="Sign in to save deals" side="left">
        {button}
      </Tooltip>
    )
  }

  return button
}
