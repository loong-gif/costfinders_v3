import Link from 'next/link'

/**
 * Site footer.
 *
 * Exists primarily to make the legal pages reachable. /privacy and /terms were
 * previously linked only from each other, so a visitor had no route to either — a
 * privacy policy nobody can find does not satisfy a disclosure obligation.
 */
export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border-default bg-bg-base">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Brand above the links until lg. Side by side from sm, the 384px brand block left
            Browse ~80px at 712 and every link wrapped ("How it / works"); at 768-834 "Request
            a listing change" still did (device matrix, 2026-09-28). */}
        <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-sm">
            <p className="font-display font-semibold text-text-primary">
              CostFinders
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Compare the medspa treatment prices providers advertise publicly
              near you.
            </p>
            <p className="mt-3 text-xs text-text-muted">
              CostFinders is an information and referral platform, not a medical
              provider. Pricing is informational and is not an offer of
              treatment.
            </p>
          </div>

          <nav
            aria-label="Footer"
            className="flex flex-col gap-6 sm:flex-row sm:gap-12"
          >
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Browse
              </h2>
              {/* nowrap: the longest label is "Request a listing change", ~170px, which fits
                  every width this column meets. */}
              <ul className="mt-3 space-y-2 text-sm whitespace-nowrap">
                <li>
                  <Link
                    href="/deals"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Deals
                  </Link>
                </li>
                <li>
                  <Link
                    href="/treatments"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Treatments
                  </Link>
                </li>
                <li>
                  <Link
                    href="/guides"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Cost guides
                  </Link>
                </li>
                <li>
                  <Link
                    href="/how-it-works"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    How it works
                  </Link>
                </li>
                <li>
                  <Link
                    href="/business"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    For providers
                  </Link>
                </li>
                <li>
                  <Link
                    href="/business/listing-request?type=add"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Request a listing
                  </Link>
                </li>
                {/*
                  /business/listing-request had no entry point anywhere on the site. Listings
                  are compiled from public sources without the provider's involvement, so the
                  route a provider uses to correct or remove one has to be reachable from every
                  page — the footer is the only element that is.
                */}
                <li>
                  <Link
                    href="/business/listing-request"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Request a listing change
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                Legal
              </h2>
              <ul className="mt-3 space-y-2 text-sm">
                <li>
                  <Link
                    href="/privacy"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Terms of Service
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy/do-not-sell"
                    className="text-text-primary hover:text-accent transition-colors"
                  >
                    Do Not Sell or Share My Personal Information
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <p className="mt-8 border-t border-border-default pt-6 text-xs text-text-muted">
          © {new Date().getFullYear()} CostFinders. All rights reserved.
        </p>
      </div>
    </footer>
  )
}
