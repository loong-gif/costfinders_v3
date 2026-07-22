export default function DealsLoading() {
  return (
    <main className="pt-20 pb-20 md:pb-8 px-4 sm:px-6 lg:px-8 min-h-screen">
      <div className="max-w-7xl mx-auto animate-pulse">
        {/* Page header skeleton */}
        <div className="mb-8">
          <div className="h-5 w-48 bg-[#d4c4b0] rounded mb-4" />
          <div className="h-10 w-80 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl mb-3" />
          <div className="h-5 w-96 bg-[#f2ebe2] rounded" />
        </div>

        {/* Deals grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={`deal-skel-${i}`}
              className={`h-56 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl ${i >= 3 ? 'hidden sm:block' : ''}`}
            />
          ))}
        </div>
      </div>
    </main>
  )
}
