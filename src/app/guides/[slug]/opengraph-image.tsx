import { ogCard } from '@/lib/og/ogCard'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

function capitalize(str: string) {
  return str
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  // Parse slug format: "treatment-cost-city" (e.g., "botox-cost-tucson")
  const costIndex = slug.indexOf('-cost-')
  const treatmentLabel =
    costIndex > 0 ? capitalize(slug.slice(0, costIndex)) : 'Treatment'
  const cityLabel =
    costIndex > 0
      ? capitalize(slug.slice(costIndex + '-cost-'.length))
      : 'Your City'

  return ogCard({
    eyebrow: 'Cost guide',
    title: `${treatmentLabel} cost in ${cityLabel}`,
    // Not "Verified Providers": nothing on this site verifies a provider. These are the
    // prices providers publish.
    sub: 'Compare the prices providers publish.',
  })
}
