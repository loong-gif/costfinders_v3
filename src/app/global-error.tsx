'use client'

import { useEffect } from 'react'

/**
 * Last-resort error boundary.
 *
 * src/app/error.tsx renders INSIDE the root layout, so it cannot catch an error thrown by
 * the root layout itself — and src/app/layout.tsx is not trivial: it mounts three auth
 * context providers, the header and the footer. Without this file such an error falls
 * through to Next's built-in page, which in production is an unstyled "Application error"
 * with no way back to the site.
 *
 * global-error replaces the entire document, so it must render its own <html> and <body>
 * and cannot use the layout's fonts, providers, or Phosphor icons (the icon package is
 * loaded through the layout that just failed). Colours are the Price Engine values as raw hex
 * for the same reason the tokens are not available here — this file deliberately depends on
 * nothing, which is the only property that makes a last-resort boundary trustworthy.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // The digest is the only handle on the server-side error, and it is the same value
    // src/instrumentation.ts reports through onRequestError — quote it when correlating.
    console.error('[GlobalError]', {
      message: error.message,
      digest: error.digest,
      timestamp: new Date().toISOString(),
    })
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#ffffff',
          color: '#0b1220',
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, sans-serif',
          padding: '1.5rem',
        }}
      >
        <main style={{ maxWidth: '32rem', textAlign: 'center' }}>
          <div
            aria-hidden="true"
            style={{
              width: '4rem',
              height: '4rem',
              margin: '0 auto 1.5rem',
              borderRadius: '1rem',
              backgroundColor: '#fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* Inline SVG: the icon package loads through the layout that just failed. */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#dc2626"
              strokeWidth="1.5"
              strokeLinecap="round"
              role="img"
              aria-label="Warning"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7.5v5.5" />
              <circle
                cx="12"
                cy="16.25"
                r="0.75"
                fill="#dc2626"
                stroke="none"
              />
            </svg>
          </div>

          <h1
            style={{
              fontSize: '2rem',
              fontWeight: 700,
              margin: '0 0 1rem',
              lineHeight: 1.2,
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '1.05rem',
              color: '#4b5563',
              margin: '0 0 2.5rem',
              lineHeight: 1.6,
            }}
          >
            We hit an unexpected error. Please try again or head back to the
            homepage.
          </p>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
              flexWrap: 'wrap',
            }}
          >
            <button
              type="button"
              onClick={() => reset()}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                border: 'none',
                backgroundColor: '#cc3714',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: 500,
                fontFamily: 'inherit',
                cursor: 'pointer',
              }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '0.75rem',
                backgroundColor: '#f4f5f7',
                border: '1px solid #e5e7eb',
                color: '#0b1220',
                fontSize: '1rem',
                fontWeight: 500,
                textDecoration: 'none',
                display: 'inline-block',
              }}
            >
              Back to home
            </a>
          </div>
        </main>
      </body>
    </html>
  )
}
