import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import { SITE_CONFIG } from '@/lib/seo/metadata'

/**
 * Every Open Graph image on the site, in Price Engine: white ground, ink display type, the
 * wordmark's coral dot, and the range bar from MASTER.md as the one graphic.
 *
 * Satori renders these, so nothing from globals.css or next/font reaches them: the colours
 * are the token values as literals (kept in step with globals.css by hand — there are five),
 * and the fonts are static TTFs read from disk, because next/font's files are not addressable
 * from an image route and Satori cannot read variable fonts or WOFF2.
 */
export const OG_SIZE = { width: 1200, height: 630 }

const INK = '#0b1220'
const SECONDARY = '#4b5563'
const MUTED = '#5f6979'
const HAIRLINE = '#e5e7eb'
const CORAL_GRAPHIC = '#ff5a36'

const FONT_DIR = join(process.cwd(), 'src/lib/og/fonts')

interface OgCardProps {
  /** Small caps line above the title — "Cost guide", "Treatment". Optional. */
  eyebrow?: string
  title: string
  sub: string
}

export async function ogCard({ eyebrow, title, sub }: OgCardProps) {
  const [display, body] = await Promise.all([
    readFile(join(FONT_DIR, 'InterTight-Bold.ttf')),
    readFile(join(FONT_DIR, 'Inter-Regular.ttf')),
  ])
  const host = new URL(SITE_CONFIG.url).host

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px 80px',
        background: '#ffffff',
        fontFamily: 'Inter',
        color: INK,
      }}
    >
      <div
        style={{
          display: 'flex',
          fontFamily: 'Inter Tight',
          fontSize: 40,
          letterSpacing: -1,
        }}
      >
        CostFinders
        <span style={{ color: CORAL_GRAPHIC }}>.</span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {eyebrow && (
          <div
            style={{
              display: 'flex',
              fontSize: 24,
              color: MUTED,
              textTransform: 'uppercase',
              letterSpacing: 2,
              marginBottom: 16,
            }}
          >
            {eyebrow}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            fontFamily: 'Inter Tight',
            fontSize: 76,
            lineHeight: 1.02,
            letterSpacing: -2.5,
            maxWidth: 1000,
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: 'flex',
            fontSize: 32,
            color: SECONDARY,
            marginTop: 20,
            maxWidth: 960,
          }}
        >
          {sub}
        </div>
      </div>

      {/* The range bar motif: hairline track, coral fill to a median, ink marker. Decorative. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
        <div
          style={{
            display: 'flex',
            position: 'relative',
            flex: 1,
            height: 10,
            borderRadius: 9999,
            background: HAIRLINE,
          }}
        >
          <div
            style={{
              display: 'flex',
              width: '42%',
              height: 10,
              borderRadius: 9999,
              background: CORAL_GRAPHIC,
            }}
          />
          <div
            style={{
              display: 'flex',
              position: 'absolute',
              left: '42%',
              top: -9,
              width: 4,
              height: 28,
              borderRadius: 2,
              background: INK,
            }}
          />
        </div>
        <div style={{ display: 'flex', fontSize: 24, color: MUTED }}>
          {host}
        </div>
      </div>
    </div>,
    {
      ...OG_SIZE,
      fonts: [
        { name: 'Inter Tight', data: display, weight: 700, style: 'normal' },
        { name: 'Inter', data: body, weight: 400, style: 'normal' },
      ],
    },
  )
}
