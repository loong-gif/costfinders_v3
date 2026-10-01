import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import type { Metadata, Viewport } from 'next'
import { Inter, Inter_Tight } from 'next/font/google'
import { GlobalHeader } from '@/components/layout/globalHeader'
import { SiteFooter } from '@/components/layout/siteFooter'
import { OrganizationSchema, WebsiteSchema } from '@/components/seo'
import { AuthProvider } from '@/lib/context/authContext'
import { BusinessAuthProvider } from '@/lib/context/businessAuthContext'
import { ClaimsProvider } from '@/lib/context/claimsContext'
import { SITE_CONFIG } from '@/lib/seo/metadata'
import './globals.css'

// Inter for UI and body, Inter Tight for display. globals.css maps them to
// --font-sans / --font-display; nothing else should reference these variables.
const inter = Inter({
  variable: '--font-inter',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
})

const interTight = Inter_Tight({
  variable: '--font-inter-tight',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
})

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#ffffff',
}

export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url),
  title: {
    default: 'CostFinders - Compare MedSpa Prices',
    template: '%s | CostFinders',
  },
  // The site-wide default description, so it is the snippet for every page that does not
  // generate its own. It said "Save 20-70%", which the offer corpus contradicts: on 2026-09-28,
  // 600 of the 938 offers shown carry a discount_percent (median 20%), and only 163 print a
  // regular price, since one is printed only where the clinic's own words state it. A range
  // claim needs the same substantiation as an "up to" claim, and this one was falsifiable in
  // one query. Any figure that goes back in here has to be computed, not written.
  description:
    'Compare medspa prices near you. See what local providers advertise for Botox, fillers, facials, and laser treatments, side by side.',
  applicationName: 'CostFinders',
  // favicon.ico comes from src/app; theme-color lives in `viewport` above. The PNGs are
  // public/icon.png resized — regenerate them if the mark changes.
  icons: { apple: '/apple-touch-icon.png' },
  manifest: '/site.webmanifest',
  generator: 'Next.js',
  keywords: [
    'medspa deals',
    'botox prices',
    'medspa comparison',
    'aesthetic treatments',
    'filler prices',
    'laser treatments',
    'medspa near me',
  ],
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: 'CostFinders',
    images: [
      {
        url: '/opengraph-image',
        width: 1200,
        height: 630,
        alt: 'CostFinders - Compare MedSpa Prices',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@costfinders',
  },
  robots: {
    // No `index: true`. Indexing is the default, so declaring it site-wide bought nothing —
    // and it landed on not-found pages too, which Next already marks noindex, leaving them
    // serving "noindex" and "index, follow" in the same head. The googleBot directives below
    // are the part that does real work: they let Google show a large image and an unclipped
    // snippet in results.
    googleBot: {
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="preconnect"
          href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co"
        />
        <link
          rel="dns-prefetch"
          href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co"
        />
      </head>
      <body
        className={`${inter.variable} ${interTight.variable} font-sans antialiased`}
      >
        <WebsiteSchema />
        <OrganizationSchema />
        <AuthProvider>
          <BusinessAuthProvider>
            <ClaimsProvider>
              <GlobalHeader />
              {children}
              <SiteFooter />
            </ClaimsProvider>
          </BusinessAuthProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
