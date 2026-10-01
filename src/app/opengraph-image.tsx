import { ogCard } from '@/lib/og/ogCard'

export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/*
  The default card for every page without its own. "Save 20-70%" was the site's most-shared
  claim and the least supportable — over the 670 publicly visible offers at the time, 314
  carried a discount_percent at all (median 18.2%). It states what the site does, the homepage's
  own headline, not what it saves you.
*/
export default function Image() {
  return ogCard({
    title: 'Medspa prices, compared.',
    sub: 'See what providers near you advertise for Botox, fillers, facials and laser.',
  })
}
