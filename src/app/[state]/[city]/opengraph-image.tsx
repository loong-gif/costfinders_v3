import { ogCard } from '@/lib/og/ogCard'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const titleCase = (slug: string) =>
  slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

export default async function Image({
  params,
}: {
  params: Promise<{ state: string; city: string }>
}) {
  const { state, city } = await params

  /*
    No savings percentage on a social card. Nothing here knows this city's discount
    distribution, and site-wide the data does not support one.
  */
  return ogCard({
    eyebrow: titleCase(state),
    title: `Medspa deals in ${titleCase(city)}`,
    sub: 'Compare the prices providers advertise.',
  })
}
