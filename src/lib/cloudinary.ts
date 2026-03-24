const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
const BASE_URL = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload`

interface CloudinaryOptions {
  width?: number
  height?: number
  quality?: 'auto' | number
  format?: 'auto' | 'avif' | 'webp'
  crop?: 'fill' | 'fit' | 'thumb'
  gravity?: 'auto' | 'face' | 'center'
}

/**
 * Build a Cloudinary transformation URL.
 * Falls back to a placeholder if publicId is empty.
 */
export function cloudinaryUrl(
  publicId: string,
  options: CloudinaryOptions = {},
): string {
  if (!publicId || !CLOUD_NAME) return ''

  const transforms: string[] = []

  if (options.width) transforms.push(`w_${options.width}`)
  if (options.height) transforms.push(`h_${options.height}`)
  transforms.push(`q_${options.quality ?? 'auto'}`)
  transforms.push(`f_${options.format ?? 'auto'}`)
  if (options.crop) transforms.push(`c_${options.crop}`)
  if (options.gravity) transforms.push(`g_${options.gravity}`)

  return `${BASE_URL}/${transforms.join(',')}/${publicId}`
}

/**
 * Convention-based URL for deal card images.
 * Images are stored as: deals/{businessId}/hero
 */
export function dealImageUrl(businessId: number | string): string {
  return cloudinaryUrl(`deals/${businessId}/hero`, {
    width: 400,
    height: 300,
    crop: 'fill',
    gravity: 'auto',
  })
}
