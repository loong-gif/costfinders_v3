// Stable identities for the skeleton grid — the placeholders never reorder,
// so each one owns a fixed id instead of borrowing its array index.
const SKELETON_CARDS = [
  { id: 'skel-a', className: '' },
  { id: 'skel-b', className: '' },
  { id: 'skel-c', className: '' },
  { id: 'skel-d', className: 'hidden sm:block' },
  { id: 'skel-e', className: 'hidden sm:block' },
  { id: 'skel-f', className: 'hidden sm:block' },
]

export default function Loading() {
  return (
    <main className="pt-20 pb-20 md:pb-16 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 animate-pulse">
        {/* Hero skeleton */}
        <div className="h-64 bg-bg-surface rounded-2xl mb-8" />

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SKELETON_CARDS.map((card) => (
            <div
              key={card.id}
              className={`h-48 bg-bg-surface rounded-xl ${card.className}`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
