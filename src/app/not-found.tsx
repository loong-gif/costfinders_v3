import {
  House,
  MagnifyingGlass,
  Sparkle,
  Tag,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page not found',
  description:
    'The page you are looking for does not exist. Browse medspa deals, treatments, and pricing guides on CostFinders.',
}

export default function NotFound() {
  return (
    <main className="pt-20 pb-20 md:pb-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
        <div className="w-14 h-14 rounded-full bg-bg-surface flex items-center justify-center mx-auto mb-6">
          <MagnifyingGlass
            size={28}
            weight="bold"
            className="text-text-secondary"
          />
        </div>

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-4">
          Page not found
        </h1>
        <p className="text-lg text-text-secondary mb-10 max-w-md mx-auto">
          We couldn&apos;t find the page you&apos;re looking for. It may have
          been moved or no longer exists.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors"
          >
            <House size={20} weight="light" />
            Back to home
          </Link>
          <Link
            href="/deals"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full border border-text-primary text-text-primary font-semibold hover:bg-bg-surface transition-colors"
          >
            <Tag size={20} weight="light" />
            Browse deals
          </Link>
          <Link
            href="/treatments"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full border border-text-primary text-text-primary font-semibold hover:bg-bg-surface transition-colors"
          >
            <Sparkle size={20} weight="light" />
            Treatments
          </Link>
        </div>
      </div>
    </main>
  )
}
