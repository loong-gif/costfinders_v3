'use client'

import {
  ArrowCounterClockwise,
  Tag,
  WarningCircle,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect } from 'react'

export default function DealsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[DealsError]', {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <main className="pt-20 pb-20 md:pb-16 min-h-screen">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 text-center py-16">
        <div className="w-14 h-14 rounded-full bg-error-bg flex items-center justify-center mx-auto mb-6">
          <WarningCircle size={28} weight="bold" className="text-error" />
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text-primary mb-4">
          Couldn&apos;t Load Deals
        </h1>
        <p className="text-lg text-text-secondary mb-10 max-w-md mx-auto">
          We had trouble loading deal listings. Please try again.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full bg-accent text-white font-semibold hover:bg-accent-hover transition-colors cursor-pointer"
          >
            <ArrowCounterClockwise size={20} weight="light" />
            Try again
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-full border border-text-primary text-text-primary font-semibold hover:bg-bg-surface transition-colors"
          >
            <Tag size={20} weight="light" />
            Browse all deals
          </Link>
        </div>
      </div>
    </main>
  )
}
