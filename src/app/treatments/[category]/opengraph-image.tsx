import { CATEGORY_MAP } from '@/lib/data/categories'
import { ogCard } from '@/lib/og/ogCard'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image({
  params,
}: {
  params: Promise<{ category: string }>
}) {
  const { category } = await params
  // The bucket's own label ("Facials & Lasers"), not the capitalised slug ("Facials-lasers").
  const label =
    Object.values(CATEGORY_MAP).find((c) => c.slug === category)?.label ??
    'Treatment'

  return ogCard({
    eyebrow: 'Treatment',
    title: `${label} deals`,
    sub: 'Compare the prices medspa providers advertise.',
  })
}
