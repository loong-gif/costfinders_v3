import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { GlobalHeader } from '@/components/layout/globalHeader'
import { OrganizationSchema, WebsiteSchema } from '@/components/seo'
import { AuthProvider } from '@/lib/context/authContext'
import { BusinessAuthProvider } from '@/lib/context/businessAuthContext'
import { ClaimsProvider } from '@/lib/context/claimsContext'
import './globals.css'

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  adjustFontFallback: true,
})

const manrope = Manrope({
  variable: '--font-manrope',
  subsets: ['latin'],
  display: 'optional',
  preload: false,
})

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_BASE_URL || 'https://www.costfinders.ai',
  ),
  title: {
    default: 'CostFinders - Compare MedSpa Prices',
    template: '%s | CostFinders',
  },
  description:
    'Find and compare the best medspa deals near you. Save 20-70% on Botox, fillers, facials, and laser treatments.',
  applicationName: 'CostFinders',
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
    images: [{ url: '/opengraph-image.png', width: 1200, height: 630, alt: 'CostFinders - Compare MedSpa Prices' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@costfinders',
  },
  robots: {
    index: true,
    follow: true,
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
        <link rel="preconnect" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" />
        <link rel="dns-prefetch" href="https://kdlpkjzcnbkjcvwsvlwn.supabase.co" />
        <link rel="preconnect" href="https://res.cloudinary.com" />
        <link rel="dns-prefetch" href="https://res.cloudinary.com" />
      </head>
      <body
        className={`${sora.variable} ${manrope.variable} font-sans antialiased`}
      >
        <WebsiteSchema />
        <OrganizationSchema />
        <AuthProvider>
          <BusinessAuthProvider>
            <ClaimsProvider>
              <GlobalHeader />
              {children}
            </ClaimsProvider>
          </BusinessAuthProvider>
        </AuthProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  )
}
