/**
 * Regenerates the brand icons from the Price Engine wordmark: an ink rounded square carrying a
 * white "C" and the wordmark's coral dot, and the full "CostFinders." wordmark for logo.png.
 * Rendered with the same Satori renderer and Inter Tight TTF as the Open Graph cards
 * (src/lib/og/ogCard.tsx), so the letterforms match the header.
 *
 *   npx tsx scripts/generate-brand-icons.tsx   (from the repo root)
 *
 * Writes public/icon.png (1024), public/icon.webp (256), public/logo.png (1024, schema.org
 * Organization logo) and src/app/favicon.ico (16/32/48, PNG-in-ICO). File names are unchanged
 * on purpose: they were the Warm Sand brown pin.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { ImageResponse } from 'next/og'
import sharp from 'sharp'

const INK = '#0b1220'
const CORAL_GRAPHIC = '#ff5a36'
const ROOT = process.cwd()

async function render(node: React.ReactElement, size: number): Promise<Buffer> {
  const font = await readFile(join(ROOT, 'src/lib/og/fonts/InterTight-Bold.ttf'))
  const res = new ImageResponse(node, {
    width: size,
    height: size,
    fonts: [{ name: 'Inter Tight', data: font, weight: 700, style: 'normal' }],
  })
  return Buffer.from(await res.arrayBuffer())
}

const mark = (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: INK,
      borderRadius: 224,
      fontFamily: 'Inter Tight',
      fontSize: 720,
      lineHeight: 1,
      color: '#ffffff',
      letterSpacing: -20,
    }}
  >
    C<span style={{ color: CORAL_GRAPHIC }}>.</span>
  </div>
)

const wordmark = (
  <div
    style={{
      width: '100%',
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#ffffff',
      fontFamily: 'Inter Tight',
      fontSize: 150,
      letterSpacing: -5,
      color: INK,
    }}
  >
    CostFinders<span style={{ color: CORAL_GRAPHIC }}>.</span>
  </div>
)

/** An .ico holding PNG entries (supported by every browser since IE Vista-era). */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type: icon
  header.writeUInt16LE(pngs.length, 4)
  let offset = 6 + 16 * pngs.length
  const entries = pngs.map(({ size, data }) => {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt8(0, 2) // palette
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // colour planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += data.length
    return e
  })
  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)])
}

async function main() {
  const icon = await render(mark, 1024)
  await writeFile(join(ROOT, 'public/icon.png'), icon)
  await sharp(icon).resize(256).webp({ quality: 90 }).toFile(join(ROOT, 'public/icon.webp'))
  await writeFile(join(ROOT, 'public/logo.png'), await render(wordmark, 1024))
  const favicon = await Promise.all(
    [16, 32, 48].map(async (size) => ({
      size,
      data: await sharp(icon).resize(size).png().toBuffer(),
    })),
  )
  await writeFile(join(ROOT, 'src/app/favicon.ico'), ico(favicon))
  console.log('icon.png, icon.webp, logo.png, favicon.ico written')
}

main()
