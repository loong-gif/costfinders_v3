import { ogCard } from '@/lib/og/ogCard'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/**
 * Social card for every /guides URL.
 *
 * A page-level `openGraph` object replaces the root layout's rather than merging into it, so
 * defining openGraph without images stripped og:image from the whole family — 1,067 of the
 * sitemap's URLs shared. A file-based image is merged back in by Next regardless.
 */
export default function Image() {
  return ogCard({
    eyebrow: 'Cost guides',
    title: 'Medspa cost guides',
    sub: 'What treatments actually cost, city by city.',
  })
}
