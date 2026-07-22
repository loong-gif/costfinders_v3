'use client'

import {
  ArrowCounterClockwise,
  House,
  WarningCircle,
} from '@phosphor-icons/react'
import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[ErrorBoundary]', {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-6">
          <WarningCircle size={32} weight="light" className="text-red-600" />
        </div>

        <h1 className="text-4xl font-bold text-[#451a03] mb-4">
          Something Went Wrong
        </h1>
        <p className="text-lg text-[#78350f] mb-10 max-w-md mx-auto">
          We hit an unexpected error. Please try again or head back to the
          homepage.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#92400e] text-white font-medium hover:bg-[#b45309] transition-colors cursor-pointer"
          >
            <ArrowCounterClockwise size={20} weight="light" />
            Try Again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0] text-[#451a03] font-medium hover:bg-[#e8ddd0] transition-colors"
          >
            <House size={20} weight="light" />
            Back to Home
          </a>
        </div>
      </div>
    </main>
  )
}
