'use client'

import { Heart } from '@phosphor-icons/react'
import { Tooltip } from '@/components/ui/tooltip'
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
    } else {
      saveDeal(dealId)
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
        transition-all duration-200
        ${
          isAuthenticated
            ? 'hover:bg-[#f2ebe2] hover:scale-110 active:scale-95 cursor-pointer'
            : 'cursor-not-allowed opacity-60'
        }
        ${saved ? 'text-red-500' : 'text-[#78350f] hover:text-[#451a03]'}
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
