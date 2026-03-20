'use client'

import { MapPin, Spinner } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import { useLocation } from '@/lib/context/locationContext'
import { DEFAULT_CITY, slugifyCity } from '@/lib/mock-data'

/**
 * DealsRedirect - Detects user location and redirects to city deals page
 *
 * Flow:
 * 1. Check if user has a stored/selected city -> redirect immediately
 * 2. Attempt geolocation detection
 * 3. Redirect to detected city or fallback to default
 */
export function DealsRedirect() {
  const router = useRouter()
  const { state: locationState, detectLocation } = useLocation()
  const [status, setStatus] = useState<'detecting' | 'redirecting' | 'error'>(
    'detecting',
  )

  useEffect(() => {
    async function handleRedirect() {
      try {
        // If user already has a city (from previous session or manual selection)
        if (
          locationState.current.city &&
          locationState.current.type !== 'default'
        ) {
          setStatus('redirecting')
          const citySlug = slugifyCity(locationState.current.city.name)
          router.replace(`/deals/${citySlug}`)
          return
        }

        // Attempt to detect location
        setStatus('detecting')
        await detectLocation()

        // After detection, check again
        if (locationState.current.city) {
          setStatus('redirecting')
          const citySlug = slugifyCity(locationState.current.city.name)
          router.replace(`/deals/${citySlug}`)
        } else {
          // Fallback to default city
          setStatus('redirecting')
          const citySlug = slugifyCity(DEFAULT_CITY.name)
          router.replace(`/deals/${citySlug}`)
        }
      } catch {
        // On error, redirect to default city
        setStatus('redirecting')
        const citySlug = slugifyCity(DEFAULT_CITY.name)
        router.replace(`/deals/${citySlug}`)
      }
    }

    handleRedirect()
  }, [
    locationState.current.city,
    locationState.current.type,
    detectLocation,
    router,
  ])

  // Watch for location changes after detection
  useEffect(() => {
    if (
      status === 'detecting' &&
      locationState.current.city &&
      locationState.current.type === 'detected'
    ) {
      setStatus('redirecting')
      const citySlug = slugifyCity(locationState.current.city.name)
      router.replace(`/deals/${citySlug}`)
    }
  }, [locationState.current.city, locationState.current.type, status, router])

  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto mt-20">
        <Card
          variant="glass"
          padding="lg"
          className="text-center bg-[#f2ebe2] border-[#d4c4b0] shadow-md"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center">
              {status === 'detecting' ? (
                <MapPin
                  size={32}
                  weight="duotone"
                  className="text-amber-800 animate-pulse"
                />
              ) : (
                <Spinner
                  size={32}
                  weight="bold"
                  className="text-amber-800 animate-spin"
                />
              )}
            </div>
          </div>

          <h1 className="text-xl font-semibold text-[#451a03] mb-2">
            {status === 'detecting'
              ? 'Finding Deals Near You'
              : 'Redirecting...'}
          </h1>

          <p className="text-[#78350f]">
            {status === 'detecting'
              ? 'Detecting your location to show nearby medspa deals'
              : `Taking you to deals in ${locationState.current.city?.name || DEFAULT_CITY.name}`}
          </p>
        </Card>
      </div>
    </main>
  )
}
