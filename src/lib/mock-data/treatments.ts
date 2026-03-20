import type { TreatmentCategory } from '@/types/deal'

export interface Treatment {
  id: string
  name: string
  slug: string
  categoryId: TreatmentCategory
  description: string
  averagePrice: number
  popularity: number // 1-100 score
  isActive: boolean
}

// Mutable treatments array for CRUD operations
let treatments: Treatment[] = [
  // Botox treatments
  {
    id: 'treatment-botox-forehead',
    name: 'Forehead Lines',
    slug: 'forehead-lines',
    categoryId: 'botox',
    description: 'Smooth horizontal lines across the forehead',
    averagePrice: 350,
    popularity: 92,
    isActive: true,
  },
  {
    id: 'treatment-botox-crows-feet',
    name: "Crow's Feet",
    slug: 'crows-feet',
    categoryId: 'botox',
    description: 'Reduce fine lines around the eyes',
    averagePrice: 300,
    popularity: 88,
    isActive: true,
  },
  {
    id: 'treatment-botox-frown-lines',
    name: 'Frown Lines',
    slug: 'frown-lines',
    categoryId: 'botox',
    description: 'Treat the glabellar lines between eyebrows',
    averagePrice: 325,
    popularity: 85,
    isActive: true,
  },
  {
    id: 'treatment-botox-bunny-lines',
    name: 'Bunny Lines',
    slug: 'bunny-lines',
    categoryId: 'botox',
    description: 'Smooth lines on the sides of the nose',
    averagePrice: 200,
    popularity: 45,
    isActive: true,
  },

  // Fillers treatments
  {
    id: 'treatment-filler-lip',
    name: 'Lip Filler',
    slug: 'lip-filler',
    categoryId: 'fillers',
    description: 'Add volume and shape to lips',
    averagePrice: 650,
    popularity: 95,
    isActive: true,
  },
  {
    id: 'treatment-filler-cheek',
    name: 'Cheek Filler',
    slug: 'cheek-filler',
    categoryId: 'fillers',
    description: 'Restore volume to cheeks and midface',
    averagePrice: 750,
    popularity: 78,
    isActive: true,
  },
  {
    id: 'treatment-filler-jawline',
    name: 'Jawline Filler',
    slug: 'jawline-filler',
    categoryId: 'fillers',
    description: 'Define and contour the jawline',
    averagePrice: 800,
    popularity: 72,
    isActive: true,
  },
  {
    id: 'treatment-filler-undereye',
    name: 'Under-eye Filler',
    slug: 'under-eye-filler',
    categoryId: 'fillers',
    description: 'Reduce hollow under-eye appearance',
    averagePrice: 700,
    popularity: 68,
    isActive: true,
  },

  // Facials treatments
  {
    id: 'treatment-facial-hydra',
    name: 'HydraFacial',
    slug: 'hydrafacial',
    categoryId: 'facials',
    description: 'Deep cleansing and hydrating facial treatment',
    averagePrice: 250,
    popularity: 90,
    isActive: true,
  },
  {
    id: 'treatment-facial-chemical-peel',
    name: 'Chemical Peel',
    slug: 'chemical-peel',
    categoryId: 'facials',
    description: 'Exfoliate and rejuvenate skin',
    averagePrice: 200,
    popularity: 75,
    isActive: true,
  },
  {
    id: 'treatment-facial-microneedling',
    name: 'Microneedling',
    slug: 'microneedling',
    categoryId: 'facials',
    description: 'Stimulate collagen production for smoother skin',
    averagePrice: 350,
    popularity: 82,
    isActive: true,
  },

  // Laser treatments
  {
    id: 'treatment-laser-hair-removal',
    name: 'Laser Hair Removal',
    slug: 'laser-hair-removal',
    categoryId: 'laser',
    description: 'Permanent hair reduction treatment',
    averagePrice: 300,
    popularity: 88,
    isActive: true,
  },
  {
    id: 'treatment-laser-ipl',
    name: 'IPL Photofacial',
    slug: 'ipl-photofacial',
    categoryId: 'laser',
    description: 'Treat sun damage, redness, and pigmentation',
    averagePrice: 400,
    popularity: 65,
    isActive: true,
  },
  {
    id: 'treatment-laser-resurfacing',
    name: 'Skin Resurfacing',
    slug: 'skin-resurfacing',
    categoryId: 'laser',
    description: 'Improve texture and reduce scars',
    averagePrice: 1200,
    popularity: 55,
    isActive: true,
  },

  // Body treatments
  {
    id: 'treatment-body-coolsculpting',
    name: 'CoolSculpting',
    slug: 'coolsculpting',
    categoryId: 'body',
    description: 'Non-invasive fat reduction through freezing',
    averagePrice: 1500,
    popularity: 70,
    isActive: true,
  },
]

// CRUD helpers
export function getTreatments(): Treatment[] {
  return [...treatments]
}

export function getTreatmentsByCategory(
  categoryId: TreatmentCategory,
): Treatment[] {
  return treatments.filter((t) => t.categoryId === categoryId)
}

export function getTreatmentById(id: string): Treatment | undefined {
  return treatments.find((t) => t.id === id)
}

export function createTreatment(data: Omit<Treatment, 'id'>): Treatment {
  const newTreatment: Treatment = {
    ...data,
    id: `treatment-${Date.now()}`,
  }
  treatments = [...treatments, newTreatment]
  return newTreatment
}

export function updateTreatment(
  id: string,
  data: Partial<Omit<Treatment, 'id'>>,
): Treatment | undefined {
  const index = treatments.findIndex((t) => t.id === id)
  if (index === -1) return undefined

  treatments[index] = { ...treatments[index], ...data }
  return treatments[index]
}

export function toggleTreatmentStatus(id: string): Treatment | undefined {
  const index = treatments.findIndex((t) => t.id === id)
  if (index === -1) return undefined

  treatments[index] = {
    ...treatments[index],
    isActive: !treatments[index].isActive,
  }
  return treatments[index]
}

export function deleteTreatment(id: string): boolean {
  const initialLength = treatments.length
  treatments = treatments.filter((t) => t.id !== id)
  return treatments.length < initialLength
}

// Stats helper
export function getTreatmentStats() {
  const total = treatments.length
  const active = treatments.filter((t) => t.isActive).length
  const byCategory = {
    botox: treatments.filter((t) => t.categoryId === 'botox').length,
    fillers: treatments.filter((t) => t.categoryId === 'fillers').length,
    facials: treatments.filter((t) => t.categoryId === 'facials').length,
    laser: treatments.filter((t) => t.categoryId === 'laser').length,
    body: treatments.filter((t) => t.categoryId === 'body').length,
    skincare: treatments.filter((t) => t.categoryId === 'skincare').length,
  }
  return { total, active, byCategory }
}
