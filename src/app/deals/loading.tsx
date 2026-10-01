import { DealListSkeleton } from '@/components/features/dealCardSkeleton'

export default function DealsLoading() {
  return (
    <main className="pt-20 pb-20 md:pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-6 animate-pulse">
          <div className="h-5 w-32 bg-bg-surface rounded mb-4" />
          <div className="h-10 w-80 max-w-full bg-bg-surface rounded-xl mb-3" />
          <div className="h-5 w-96 max-w-full bg-bg-surface rounded" />
        </div>

        {/* The filter bar's one row of chips, then the rows the list will hold. */}
        <div className="mb-4 flex gap-2 overflow-hidden py-1">
          {['w-24', 'w-32', 'w-24', 'w-24', 'w-20'].map((width, i) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders that never reorder
              key={i}
              className={`h-11 shrink-0 rounded-full bg-bg-surface animate-pulse ${width}`}
            />
          ))}
        </div>
        <DealListSkeleton rows={8} />
      </div>
    </main>
  )
}
