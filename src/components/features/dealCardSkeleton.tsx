const block = 'rounded bg-bg-surface animate-pulse'

/** One DealCard row — icon, two lines, price, save button — laid out as OfferRow lays it out. */
function DealCardSkeleton() {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3 sm:flex-nowrap sm:gap-x-4 sm:px-4">
      <div className={`h-8 w-8 shrink-0 rounded-lg sm:h-9 sm:w-9 ${block}`} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className={`h-4 w-3/5 ${block}`} />
        <div className={`h-3 w-2/5 ${block}`} />
      </div>
      <div className="order-last basis-full pl-11 sm:order-none sm:basis-auto sm:pl-0">
        <div className={`h-6 w-20 ${block}`} />
      </div>
      <div className={`h-11 w-11 shrink-0 rounded-full ${block}`} />
    </div>
  )
}

/** A DealList while it loads: the same frame and dividers, so nothing jumps when rows arrive. */
export function DealListSkeleton({ rows }: { rows: number }) {
  return (
    <div className="divide-y divide-border-default overflow-hidden rounded-2xl border border-border-default bg-bg-elevated">
      {Array.from({ length: rows }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed placeholders that never reorder
        <DealCardSkeleton key={i} />
      ))}
    </div>
  )
}
