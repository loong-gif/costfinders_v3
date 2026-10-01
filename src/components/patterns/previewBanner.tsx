import { Flask } from '@phosphor-icons/react/dist/ssr'

interface PreviewBannerProps {
  /** What this screen will do once it is backed by real data. */
  children: React.ReactNode
}

/**
 * Marks a screen whose numbers are illustrative rather than real.
 *
 * Several monetization surfaces (lead pricing, lead balances, sponsored
 * placements, billing history, platform revenue) are complete UI with no
 * backing schema, so they render fixture data. Left unlabelled, an admin can
 * read fabricated revenue as fact and act on it — which is why every one of
 * these screens carries this banner until it has a real data source.
 */
export function PreviewBanner({ children }: PreviewBannerProps) {
  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl bg-warning-bg px-4 py-3"
    >
      <Flask
        size={20}
        weight="light"
        className="mt-0.5 shrink-0 text-warning"
        aria-hidden="true"
      />
      <div className="text-sm text-text-secondary">
        <span className="font-semibold text-text-primary">
          Preview — sample numbers.{' '}
        </span>
        {children}
      </div>
    </div>
  )
}
