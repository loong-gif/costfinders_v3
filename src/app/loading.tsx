export default function Loading() {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Hero skeleton */}
        <div className="h-64 bg-[#f2ebe2] border border-[#d4c4b0] rounded-2xl mb-8" />

        {/* Content grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`skel-${i}`}
              className={`h-48 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl ${i >= 3 ? 'hidden sm:block' : ''}`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
