interface PriceRangeBarProps {
  min: number
  max: number
  /** Where the coral fill ends: the typical (median) price. */
  median: number
  /** One deal's price, drawn as an ink tick. */
  marker?: number | null
  /** Printed as given — the caller formats and says the basis ("$3.15", "typical $10/unit"). */
  minLabel: string
  maxLabel: string
  medianLabel: string
  markerLabel?: string
  /** Screen-reader sentence for the whole bar. Defaults to the labels joined. */
  label?: string
  className?: string
}

/** 0–100 along the track; a zero-width range puts everything in the middle. */
function position(value: number, min: number, max: number): number {
  if (!(max > min)) return 50
  return Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100))
}

/** A label centred on its point, except near an end, where centring would run it off the bar. */
function anchor(pct: number): string {
  if (pct < 15) return 'translate-x-0'
  if (pct > 85) return '-translate-x-full'
  return '-translate-x-1/2'
}

/**
 * A price range: a track from min to max, coral to the typical price, an ink tick for one deal.
 *
 * Every number is printed as text beside the bar, and the bar is one `role="img"` whose label
 * reads them in order, so nothing is carried by position or colour alone.
 */
export function PriceRangeBar({
  min,
  max,
  median,
  marker = null,
  minLabel,
  maxLabel,
  medianLabel,
  markerLabel,
  label,
  className = '',
}: PriceRangeBarProps) {
  const medianAt = position(median, min, max)
  const markerAt = marker == null ? null : position(marker, min, max)
  const spoken =
    label ??
    [`${minLabel} to ${maxLabel}`, medianLabel, markerLabel]
      .filter(Boolean)
      .join(', ')

  const track = (
    <div className="relative h-1.5 flex-1 rounded-full bg-border-default">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-accent-graphic"
        style={{ width: `${medianAt}%` }}
      />
      {markerAt != null && (
        <div
          className="absolute top-1/2 h-4 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-text-primary"
          style={{ left: `${markerAt}%` }}
        />
      )}
    </div>
  )

  // A grid, so the positioned labels share the track's column and line up with its points.
  return (
    <div
      role="img"
      aria-label={spoken}
      className={`grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2 text-xs tabular-nums ${className}`}
    >
      <div className="relative col-start-2 mb-1 h-4 font-medium text-text-primary">
        <span
          className={`absolute whitespace-nowrap ${anchor(medianAt)}`}
          style={{ left: `${medianAt}%` }}
        >
          {medianLabel}
        </span>
      </div>
      <span className="col-start-1 text-text-muted">{minLabel}</span>
      {track}
      <span className="text-text-muted">{maxLabel}</span>
      {markerAt != null && markerLabel && (
        <div className="relative col-start-2 mt-1 h-4 font-medium text-text-primary">
          <span
            className={`absolute whitespace-nowrap ${anchor(markerAt)}`}
            style={{ left: `${markerAt}%` }}
          >
            {markerLabel}
          </span>
        </div>
      )}
    </div>
  )
}
