'use client'

import { Heart } from '@phosphor-icons/react'
import { Tooltip } from '@/components/ui/tooltip'
import { trackEvent } from '@/lib/analytics'
import { useAuth } from '@/lib/context/authContext'

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
  const { state, saveDeal, unsaveDeal, isDealSaved } = useAuth()
  const { isAuthenticated } = state
  const saved = isDealSaved(dealId)

  const iconSize = size === 'sm' ? 20 : 24
  const buttonSize = size === 'sm' ? 'w-11 h-11' : 'w-11 h-11'

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()

    if (!isAuthenticated) return

    if (saved) {
      unsaveDeal(dealId)
      trackEvent('deal_unsaved', { dealId })
    } else {
      saveDeal(dealId)
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
        bg-bg-elevated
        border border-border-default
        shadow-sm
        transition-colors duration-200
        ${
          isAuthenticated
            ? 'hover:border-border-hover cursor-pointer'
            : 'cursor-not-allowed opacity-60'
        }
        ${saved ? 'text-accent' : 'text-text-secondary hover:text-text-primary'}
        ${className}
      `}
      aria-label={saved ? 'Remove from favorites' : 'Add to favorites'}
    >
      <Heart size={iconSize} weight={saved ? 'fill' : 'regular'} />
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
