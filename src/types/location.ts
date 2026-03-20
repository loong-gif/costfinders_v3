export interface City {
  id: string
  name: string
  state: string
  stateCode: string
  latitude: number
  longitude: number
  timezone: string
  isActive: boolean
}

export interface LocationArea {
  id: string
  cityId: string
  name: string
  latitude: number
  longitude: number
  radiusMiles: number
  isActive?: boolean
}
