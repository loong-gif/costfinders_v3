import {
  House,
  MagnifyingGlass,
  Sparkle,
  Tag,
} from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Page Not Found',
  description:
    'The page you are looking for does not exist. Browse medspa deals, treatments, and pricing guides on CostFinders.',
}

export default function NotFound() {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-2xl mx-auto text-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-amber-800/10 flex items-center justify-center mx-auto mb-6">
          <MagnifyingGlass
            size={32}
            weight="light"
            className="text-amber-800"
          />
        </div>

        <h1 className="text-4xl font-bold text-[#451a03] mb-4">
          Page Not Found
        </h1>
        <p className="text-lg text-[#78350f] mb-10 max-w-md mx-auto">
          We couldn&apos;t find the page you&apos;re looking for. It may have
          been moved or no longer exists.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#92400e] text-white font-medium hover:bg-[#b45309] transition-colors"
          >
            <House size={20} weight="light" />
            Back to Home
          </Link>
          <Link
            href="/deals"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0] text-[#451a03] font-medium hover:bg-[#e8ddd0] transition-colors"
          >
            <Tag size={20} weight="light" />
            Browse Deals
          </Link>
          <Link
            href="/treatments"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0] text-[#451a03] font-medium hover:bg-[#e8ddd0] transition-colors"
          >
            <Sparkle size={20} weight="light" />
            Treatments
          </Link>
        </div>
      </div>
    </main>
  )
}
