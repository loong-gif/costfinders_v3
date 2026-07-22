import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default async function Image({
  params,
}: {
  params: Promise<{ state: string; city: string }>
}) {
  const { state, city } = await params
  const cityName = city
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  const stateName = state
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')

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
            fontSize: 24,
            color: '#92400e',
            fontWeight: 500,
            marginBottom: 12,
            display: 'flex',
          }}
        >
          CostFinders
        </div>
        <div
          style={{
            fontSize: 52,
            fontWeight: 700,
            color: '#451a03',
            marginBottom: 16,
            textAlign: 'center',
            display: 'flex',
          }}
        >
          MedSpa Deals in {cityName}
        </div>
        <div
          style={{
            fontSize: 26,
            color: '#78350f',
            display: 'flex',
          }}
        >
          {stateName} &bull; Compare Prices &amp; Save Up to 70%
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
