'use client'

import { useCallback, useState } from 'react'

export interface GeolocationState {
  coordinates: {
    latitude: number
    longitude: number
  } | null
  accuracy: number | null
  timestamp: number | null
  isLoading: boolean
  error: string | null
  isSupported: boolean
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  timeout?: number
  maximumAge?: number
}

const defaultOptions: UseGeolocationOptions = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000, // Cache position for 1 minute
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const mergedOptions = { ...defaultOptions, ...options }

  const [state, setState] = useState<GeolocationState>({
    coordinates: null,
    accuracy: null,
    timestamp: null,
    isLoading: false,
    error: null,
    isSupported: typeof navigator !== 'undefined' && 'geolocation' in navigator,
  })

  const getErrorMessage = (error: GeolocationPositionError): string => {
    switch (error.code) {
      case error.PERMISSION_DENIED:
        return 'Location permission denied. Please enable location access in your browser settings.'
      case error.POSITION_UNAVAILABLE:
        return 'Location information is unavailable. Please try again later.'
      case error.TIMEOUT:
        return 'Location request timed out. Please try again.'
      default:
        return 'An unknown error occurred while getting your location.'
    }
  }

  const requestLocation = useCallback((): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!state.isSupported) {
        const errorMsg = 'Geolocation is not supported by your browser.'
        setState((prev) => ({ ...prev, error: errorMsg, isLoading: false }))
        reject(new Error(errorMsg))
        return
      }

      setState((prev) => ({ ...prev, isLoading: true, error: null }))

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setState({
            coordinates: {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            },
            accuracy: position.coords.accuracy,
            timestamp: position.timestamp,
            isLoading: false,
            error: null,
            isSupported: true,
          })
          resolve(position)
        },
        (error) => {
          const errorMsg = getErrorMessage(error)
          setState((prev) => ({
            ...prev,
            isLoading: false,
            error: errorMsg,
          }))
          reject(new Error(errorMsg))
        },
        {
          enableHighAccuracy: mergedOptions.enableHighAccuracy,
          timeout: mergedOptions.timeout,
          maximumAge: mergedOptions.maximumAge,
        },
      )
    })
  }, [
    state.isSupported,
    mergedOptions.enableHighAccuracy,
    mergedOptions.timeout,
    mergedOptions.maximumAge,
    getErrorMessage,
  ])

  const clearLocation = useCallback(() => {
    setState((prev) => ({
      ...prev,
      coordinates: null,
      accuracy: null,
      timestamp: null,
      error: null,
    }))
  }, [])

  return {
    ...state,
    requestLocation,
    clearLocation,
  }
}
