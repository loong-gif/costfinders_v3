'use server'

import { logger } from '@/lib/logger'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GooglePlaceResult {
  place_id: string
  name: string
  address: string
  city: string
  website: string | null
  rating: number | null
  review_count: number | null
  category: string | null
  latitude: number
  longitude: number
}

interface PlacesApiPlace {
  id: string
  displayName?: { text: string; languageCode?: string }
  formattedAddress?: string
  addressComponents?: {
    longText: string
    shortText: string
    types: string[]
  }[]
  location?: { latitude: number; longitude: number }
  websiteUri?: string
  rating?: number
  userRatingCount?: number
  primaryTypeDisplayName?: { text: string }
  nationalPhoneNumber?: string
}

interface PlacesApiResponse {
  places?: PlacesApiPlace[]
}

interface SearchResult {
  success: boolean
  error?: string
  places?: GooglePlaceResult[]
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/**
 * Search Google Places API (New) for businesses by text query.
 * Returns structured results with name, address, city, rating, etc.
 * Server-side only — API key never exposed to client.
 */
export async function searchGooglePlacesAction(
  query: string,
  limit = 10,
): Promise<SearchResult> {
  try {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return { success: false, error: 'Google Places API key not configured.' }
    }

    if (!query.trim()) {
      return { success: true, places: [] }
    }

    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchText',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask': [
            'places.id',
            'places.displayName',
            'places.formattedAddress',
            'places.addressComponents',
            'places.location',
            'places.websiteUri',
            'places.rating',
            'places.userRatingCount',
            'places.primaryTypeDisplayName',
          ].join(','),
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: limit,
          languageCode: 'en',
        }),
      },
    )

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[searchGooglePlaces] API error:', errorText)
      return { success: false, error: 'Google Places search failed.' }
    }

    const data = (await response.json()) as PlacesApiResponse

    if (!data.places || data.places.length === 0) {
      return { success: true, places: [] }
    }

    const results: GooglePlaceResult[] = data.places.map((place) => ({
      place_id: place.id,
      name: place.displayName?.text ?? '',
      address: place.formattedAddress ?? '',
      city: extractCity(place.addressComponents) ?? '',
      website: place.websiteUri ?? null,
      rating: place.rating ?? null,
      review_count: place.userRatingCount ?? null,
      category: place.primaryTypeDisplayName?.text ?? null,
      latitude: place.location?.latitude ?? 0,
      longitude: place.location?.longitude ?? 0,
    }))

    return { success: true, places: results }
  } catch (err) {
    console.error('[searchGooglePlaces] unexpected error:', err)
    logger.error('searchGooglePlacesAction failed', {
      action: 'searchGooglePlacesAction',
      error: err instanceof Error ? err.message : String(err),
    })
    return { success: false, error: 'An unexpected error occurred.' }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extract the city (locality) from Google Places address components.
 * Falls back to sublocality, then administrative area level 2.
 */
function extractCity(
  components?: PlacesApiPlace['addressComponents'],
): string | null {
  if (!components) return null

  // Try locality first (city)
  const locality = components.find((c) => c.types.includes('locality'))
  if (locality) return locality.longText

  // Fall back to sublocality
  const sublocality = components.find((c) =>
    c.types.includes('sublocality_level_1'),
  )
  if (sublocality) return sublocality.longText

  // Fall back to admin area level 2 (county)
  const admin2 = components.find((c) =>
    c.types.includes('administrative_area_level_2'),
  )
  if (admin2) return admin2.longText

  return null
}
