import { ImageResponse } from 'next/og'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'
export const runtime = 'edge'

export default function Image() {
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
          padding: '60px',
          borderRadius: '24px',
          background: 'rgba(255, 255, 255, 0.6)',
          border: '1px solid #d4c4b0',
        }}
      >
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#451a03',
            marginBottom: 16,
            display: 'flex',
          }}
        >
          CostFinders
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#78350f',
            marginBottom: 32,
            display: 'flex',
          }}
        >
          Compare MedSpa Prices &amp; Save 20-70%
        </div>
        <div
          style={{
            display: 'flex',
            gap: 24,
          }}
        >
          {['Botox', 'Fillers', 'Facials', 'Laser', 'Body', 'Skincare'].map(
            (tag) => (
              <div
                key={tag}
                style={{
                  padding: '8px 20px',
                  borderRadius: '9999px',
                  background: 'rgba(146, 64, 14, 0.08)',
                  border: '1px solid rgba(146, 64, 14, 0.2)',
                  color: '#92400e',
                  fontSize: 18,
                  fontWeight: 500,
                  display: 'flex',
                }}
              >
                {tag}
              </div>
            ),
          )}
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
