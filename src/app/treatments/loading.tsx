// Stable identities for the skeleton grid — the placeholders never reorder,
// so each one owns a fixed id instead of borrowing its array index.
const SKELETON_CATEGORIES = [
  { id: 'treat-skel-a', className: '' },
  { id: 'treat-skel-b', className: '' },
  { id: 'treat-skel-c', className: '' },
  { id: 'treat-skel-d', className: 'hidden sm:block' },
  { id: 'treat-skel-e', className: 'hidden sm:block' },
  { id: 'treat-skel-f', className: 'hidden sm:block' },
]

export default function TreatmentsLoading() {
  return (
    <main className="pt-20 pb-20 md:pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
        {/* Page header skeleton */}
        <div className="mb-8">
          <div className="h-5 w-48 bg-bg-surface rounded mb-4" />
          <div className="h-12 w-80 max-w-full bg-bg-surface rounded-xl mb-3" />
          <div className="h-5 w-80 bg-bg-surface rounded" />
        </div>

        {/* Category grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {SKELETON_CATEGORIES.map((card) => (
            <div
              key={card.id}
              className={`h-36 bg-bg-surface rounded-xl ${card.className}`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
