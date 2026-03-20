'use client'

import { CaretDown, MapPin } from '@phosphor-icons/react'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { LocationSelector } from '@/components/features/locationSelector'
import { Modal } from '@/components/ui/modal'
import { useLocation } from '@/lib/context/locationContext'

export function LocationDisplay() {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const { state } = useLocation()
  const router = useRouter()
  const { current } = state

  const getDisplayText = () => {
    if (!current.city) {
      return 'Set location'
    }

    if (current.area) {
      return `${current.area.name}, ${current.city.name}`
    }

    return `${current.city.name}, ${current.city.stateCode}`
  }

  const handleLocationChange = useCallback(() => {
    setIsModalOpen(false)
    router.push('/deals')
  }, [router])

  return (
    <>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsModalOpen(true)}
        className={`
          inline-flex items-center gap-1.5
          px-3 py-1.5
          bg-stone-900 hover:bg-stone-800
          border border-stone-800 rounded-full
          text-sm
          transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-amber-400/50
        `}
      >
        <MapPin
          size={16}
          weight={current.city ? 'fill' : 'regular'}
          className="text-amber-400"
        />
        <span className="text-stone-100 max-w-32 truncate">
          {getDisplayText()}
        </span>
        <CaretDown size={14} weight="bold" className="text-stone-500" />
      </button>

      {/* Location Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Set your location"
        size="sm"
      >
        <LocationSelector
          showAreaFilter={true}
          onLocationChange={handleLocationChange}
        />
      </Modal>
    </>
  )
}
