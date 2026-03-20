import type { City, LocationArea } from '@/types/location'

// Mutable cities array for CRUD operations
let citiesData: City[] = [
  // Texas cities
  {
    id: 'city-austin',
    name: 'Austin',
    state: 'Texas',
    stateCode: 'TX',
    latitude: 30.2672,
    longitude: -97.7431,
    timezone: 'America/Chicago',
    isActive: true,
  },
  {
    id: 'city-dallas',
    name: 'Dallas',
    state: 'Texas',
    stateCode: 'TX',
    latitude: 32.7767,
    longitude: -96.797,
    timezone: 'America/Chicago',
    isActive: true,
  },
  {
    id: 'city-houston',
    name: 'Houston',
    state: 'Texas',
    stateCode: 'TX',
    latitude: 29.7604,
    longitude: -95.3698,
    timezone: 'America/Chicago',
    isActive: true,
  },
  // California
  {
    id: 'city-los-angeles',
    name: 'Los Angeles',
    state: 'California',
    stateCode: 'CA',
    latitude: 34.0522,
    longitude: -118.2437,
    timezone: 'America/Los_Angeles',
    isActive: true,
  },
  // New York
  {
    id: 'city-new-york',
    name: 'New York',
    state: 'New York',
    stateCode: 'NY',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
    isActive: true,
  },
  // Florida
  {
    id: 'city-miami',
    name: 'Miami',
    state: 'Florida',
    stateCode: 'FL',
    latitude: 25.7617,
    longitude: -80.1918,
    timezone: 'America/New_York',
    isActive: true,
  },
]

// Mutable location areas array for CRUD operations
let locationAreasData: LocationArea[] = [
  // Austin areas
  {
    id: 'area-austin-downtown',
    cityId: 'city-austin',
    name: 'Downtown Austin',
    latitude: 30.2672,
    longitude: -97.7431,
    radiusMiles: 3,
    isActive: true,
  },
  {
    id: 'area-austin-north',
    cityId: 'city-austin',
    name: 'North Austin',
    latitude: 30.3672,
    longitude: -97.7431,
    radiusMiles: 5,
    isActive: true,
  },
  {
    id: 'area-austin-south',
    cityId: 'city-austin',
    name: 'South Austin',
    latitude: 30.2072,
    longitude: -97.7631,
    radiusMiles: 5,
    isActive: true,
  },
  // Dallas areas
  {
    id: 'area-dallas-uptown',
    cityId: 'city-dallas',
    name: 'Uptown Dallas',
    latitude: 32.8067,
    longitude: -96.807,
    radiusMiles: 3,
    isActive: true,
  },
  {
    id: 'area-dallas-downtown',
    cityId: 'city-dallas',
    name: 'Downtown Dallas',
    latitude: 32.7767,
    longitude: -96.797,
    radiusMiles: 3,
    isActive: true,
  },
  // Houston areas
  {
    id: 'area-houston-heights',
    cityId: 'city-houston',
    name: 'The Heights',
    latitude: 29.8004,
    longitude: -95.3998,
    radiusMiles: 3,
    isActive: true,
  },
  {
    id: 'area-houston-galleria',
    cityId: 'city-houston',
    name: 'Galleria Area',
    latitude: 29.7383,
    longitude: -95.4616,
    radiusMiles: 4,
    isActive: true,
  },
  // Los Angeles areas
  {
    id: 'area-la-beverly-hills',
    cityId: 'city-los-angeles',
    name: 'Beverly Hills',
    latitude: 34.0736,
    longitude: -118.4004,
    radiusMiles: 3,
    isActive: true,
  },
  {
    id: 'area-la-santa-monica',
    cityId: 'city-los-angeles',
    name: 'Santa Monica',
    latitude: 34.0195,
    longitude: -118.4912,
    radiusMiles: 4,
    isActive: true,
  },
  {
    id: 'area-la-west-hollywood',
    cityId: 'city-los-angeles',
    name: 'West Hollywood',
    latitude: 34.0901,
    longitude: -118.3617,
    radiusMiles: 3,
    isActive: true,
  },
  // New York areas
  {
    id: 'area-ny-manhattan',
    cityId: 'city-new-york',
    name: 'Manhattan',
    latitude: 40.7831,
    longitude: -73.9712,
    radiusMiles: 5,
    isActive: true,
  },
  {
    id: 'area-ny-upper-east-side',
    cityId: 'city-new-york',
    name: 'Upper East Side',
    latitude: 40.7736,
    longitude: -73.9566,
    radiusMiles: 2,
    isActive: true,
  },
  {
    id: 'area-ny-soho',
    cityId: 'city-new-york',
    name: 'SoHo',
    latitude: 40.7233,
    longitude: -74.003,
    radiusMiles: 2,
    isActive: true,
  },
  // Miami areas
  {
    id: 'area-miami-south-beach',
    cityId: 'city-miami',
    name: 'South Beach',
    latitude: 25.7826,
    longitude: -80.1341,
    radiusMiles: 3,
    isActive: true,
  },
  {
    id: 'area-miami-brickell',
    cityId: 'city-miami',
    name: 'Brickell',
    latitude: 25.7617,
    longitude: -80.1918,
    radiusMiles: 2,
    isActive: true,
  },
  {
    id: 'area-miami-coral-gables',
    cityId: 'city-miami',
    name: 'Coral Gables',
    latitude: 25.7215,
    longitude: -80.2684,
    radiusMiles: 4,
    isActive: true,
  },
]

// Export getters for backward compatibility (returns copies)
export const cities: City[] = citiesData
export const locationAreas: LocationArea[] = locationAreasData

// City CRUD helpers
export function getCities(): City[] {
  return [...citiesData]
}

export function getCityById(id: string): City | undefined {
  return citiesData.find((city) => city.id === id)
}

export function toggleCityStatus(id: string): City | undefined {
  const index = citiesData.findIndex((city) => city.id === id)
  if (index === -1) return undefined

  citiesData[index] = {
    ...citiesData[index],
    isActive: !citiesData[index].isActive,
  }
  return citiesData[index]
}

export function addCity(
  data: Omit<City, 'id'>
): City {
  const newCity: City = {
    ...data,
    id: `city-${Date.now()}`,
  }
  citiesData = [...citiesData, newCity]
  return newCity
}

export function updateCity(
  id: string,
  data: Partial<Omit<City, 'id'>>
): City | undefined {
  const index = citiesData.findIndex((city) => city.id === id)
  if (index === -1) return undefined

  citiesData[index] = { ...citiesData[index], ...data }
  return citiesData[index]
}

// Area CRUD helpers
export function getAreas(): LocationArea[] {
  return [...locationAreasData]
}

export function getAreasForCity(cityId: string): LocationArea[] {
  return locationAreasData.filter((area) => area.cityId === cityId)
}

export function getAreaById(id: string): LocationArea | undefined {
  return locationAreasData.find((area) => area.id === id)
}

export function toggleAreaStatus(id: string): LocationArea | undefined {
  const index = locationAreasData.findIndex((area) => area.id === id)
  if (index === -1) return undefined

  locationAreasData[index] = {
    ...locationAreasData[index],
    isActive: locationAreasData[index].isActive === false ? true : false,
  }
  return locationAreasData[index]
}

export function addArea(
  data: Omit<LocationArea, 'id'>
): LocationArea {
  const newArea: LocationArea = {
    ...data,
    id: `area-${Date.now()}`,
    isActive: data.isActive ?? true,
  }
  locationAreasData = [...locationAreasData, newArea]
  return newArea
}

export function updateArea(
  id: string,
  data: Partial<Omit<LocationArea, 'id'>>
): LocationArea | undefined {
  const index = locationAreasData.findIndex((area) => area.id === id)
  if (index === -1) return undefined

  locationAreasData[index] = { ...locationAreasData[index], ...data }
  return locationAreasData[index]
}

// Slug helpers for SEO routing

/**
 * Convert city name to URL-safe slug
 * e.g., "Los Angeles" -> "los-angeles", "New York" -> "new-york"
 */
export function slugifyCity(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Get city by URL slug (without state)
 * Used for /deals/[city] routing
 */
export function getCityBySlug(slug: string): City | undefined {
  return citiesData.find(
    (city) => city.isActive && slugifyCity(city.name) === slug
  )
}

/**
 * Get all active city slugs for static params generation
 * Used by /deals/[city] page
 */
export function getAllActiveCitySlugs(): string[] {
  return citiesData
    .filter((city) => city.isActive)
    .map((city) => slugifyCity(city.name))
}

// Stats helpers
export function getLocationStats() {
  const totalCities = citiesData.length
  const activeCities = citiesData.filter((c) => c.isActive).length
  const totalAreas = locationAreasData.length
  const activeAreas = locationAreasData.filter((a) => a.isActive !== false).length

  return { totalCities, activeCities, totalAreas, activeAreas }
}

// Mock business counts by city (simulated data)
export function getBusinessCountForCity(cityId: string): number {
  const counts: Record<string, number> = {
    'city-austin': 12,
    'city-dallas': 8,
    'city-houston': 15,
    'city-los-angeles': 22,
    'city-new-york': 18,
    'city-miami': 10,
  }
  return counts[cityId] || 0
}

// Mock deal counts by city (simulated data)
export function getDealCountForCity(cityId: string): number {
  const counts: Record<string, number> = {
    'city-austin': 24,
    'city-dallas': 16,
    'city-houston': 31,
    'city-los-angeles': 45,
    'city-new-york': 38,
    'city-miami': 22,
  }
  return counts[cityId] || 0
}
