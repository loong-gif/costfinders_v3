import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default async function Image({
  params,
}: { params: Promise<{ category: string }> }) {
  const { category } = await params
  const categoryName = category.charAt(0).toUpperCase() + category.slice(1)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #e8ddd0 0%, #f2ebe2 50%, #faf5ee 100%)',
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
            {categoryName} Treatments
          </div>
          <div
            style={{
              fontSize: 26,
              color: '#78350f',
              display: 'flex',
            }}
          >
            Compare Deals from Verified MedSpa Providers
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
      </div>
    ),
    { ...size },
  )
}
