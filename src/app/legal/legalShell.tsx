import { Warning } from '@phosphor-icons/react/dist/ssr'
import type { ReactNode } from 'react'
import { COMPANY_FACTS, LEGAL_PAGES_ARE_DRAFT } from '@/lib/legal/companyFacts'

/**
 * Shared shell for the Privacy Policy and Terms of Service pages.
 *
 * The "pending legal review" callout shows while any fact in src/lib/legal/companyFacts.ts is
 * still null. The effective date is one of those facts, and it is only set when counsel signs
 * off, so the banner cannot come down before the review does.
 */

interface LegalPageProps {
  title: string
  /** One-line summary rendered under the title. */
  intro: string
  children: ReactNode
}

export function LegalPage({ title, intro, children }: LegalPageProps) {
  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {LEGAL_PAGES_ARE_DRAFT && <DraftNotice />}

        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-3">
          {title}
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed mb-2">
          {intro}
        </p>
        {/* The effective date is the day counsel signs off, not the day this was written. */}
        <p className="text-sm text-text-muted mb-10">
          Effective date: <Fact value={COMPANY_FACTS.effectiveDate} /> · Last
          updated: 24 September 2026
        </p>

        <div className="space-y-10">{children}</div>
      </div>
    </main>
  )
}

function DraftNotice() {
  return (
    <aside className="mb-10 rounded-xl bg-warning-bg p-5 sm:p-6">
      <div className="flex gap-4">
        <Warning
          size={24}
          weight="fill"
          className="text-warning shrink-0 mt-0.5"
        />
        <div>
          <h2 className="font-display text-base font-bold text-text-primary mb-2">
            Draft — pending legal review
          </h2>
          <p className="text-sm text-text-secondary leading-relaxed">
            This document has not been reviewed or approved by a licensed
            attorney. It is published as a working draft so the policy can be
            evaluated, not as a final or binding agreement. Items marked{' '}
            <Placeholder>[to be supplied]</Placeholder> are company facts we
            have not filled in yet. Do not rely on this document for legal
            compliance, and do not treat it as CostFinders&apos; final terms
            until it has been reviewed by counsel and this notice has been
            removed.
          </p>
        </div>
      </div>
    </aside>
  )
}

/**
 * Visually marks an unfilled placeholder so it cannot be shipped unnoticed. nowrap: split over a
 * line break, "[to be supplied]" drew as two tinted boxes (device matrix, 2026-09-28).
 */
function Placeholder({ children }: { children: ReactNode }) {
  return (
    <mark className="whitespace-nowrap rounded bg-warning-bg px-1.5 py-0.5 font-mono text-[0.85em] font-medium text-warning">
      {children}
    </mark>
  )
}

/** A company fact from COMPANY_FACTS, or a marked blank while nobody has supplied it. */
export function Fact({ value }: { value: string | null }) {
  return value ?? <Placeholder>[to be supplied]</Placeholder>
}

/** The published contact address as a mailto link, or a marked blank. */
export function ContactEmail({ subject }: { subject?: string }) {
  const email = COMPANY_FACTS.contactEmail
  if (!email) return <Fact value={null} />
  const query = subject ? `?subject=${encodeURIComponent(subject)}` : ''
  return (
    <a
      href={`mailto:${email}${query}`}
      className="text-accent underline underline-offset-2 hover:text-accent-hover"
    >
      {email}
    </a>
  )
}

interface LegalSectionProps {
  id: string
  heading: string
  children: ReactNode
}

export function LegalSection({ id, heading, children }: LegalSectionProps) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-4">
        {heading}
      </h2>
      <div className="space-y-4 text-text-secondary leading-relaxed">
        {children}
      </div>
    </section>
  )
}

/** Bulleted list with the shared legal-copy spacing. */
export function LegalList({ children }: { children: ReactNode }) {
  return <ul className="list-disc pl-5 space-y-2">{children}</ul>
}
