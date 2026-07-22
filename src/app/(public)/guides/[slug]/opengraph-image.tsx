import { ImageResponse } from 'next/og'

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

  // Parse slug format: "treatment-pricing-city" (e.g., "botox-pricing-tucson")
  const pricingIndex = slug.indexOf('-pricing-')
  const treatmentLabel =
    pricingIndex > 0 ? capitalize(slug.slice(0, pricingIndex)) : 'Treatment'
  const cityLabel =
    pricingIndex > 0
      ? capitalize(slug.slice(pricingIndex + '-pricing-'.length))
      : 'Your City'

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background:
          'linear-gradient(135deg, #e8ddd0 0%, #f2ebe2 50%, #faf5ee 100%)',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '48px 60px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px solid #d4c4b0',
        }}
      >
        <div
          style={{
            fontSize: 22,
            color: '#92400e',
            fontWeight: 500,
            marginBottom: 8,
            display: 'flex',
          }}
        >
          CostFinders Pricing Guide
        </div>
        <div
          style={{
            fontSize: 48,
            fontWeight: 700,
            color: '#451a03',
            marginBottom: 16,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          {treatmentLabel} Pricing in {cityLabel}
        </div>
        <div
          style={{
            fontSize: 24,
            color: '#78350f',
            display: 'flex',
          }}
        >
          Compare Prices from Verified Providers
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 32,
          fontSize: 18,
          color: '#92400e',
          display: 'flex',
        }}
      >
        costfinders.ai
      </div>
    </div>,
    { ...size },
  )
}
