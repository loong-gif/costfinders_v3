'use client'

import { ArrowRight, WarningCircle } from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  type BusinessRow,
  getBusinessByIdAction,
} from '@/lib/actions/business-data'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { displayWebsite, telHref, websiteHref } from '@/lib/utils/contactLinks'
import { formatPhone } from '@/lib/utils/phone'

/**
 * The listing as consumers see it, read-only.
 *
 * This was an edit form that could not save: master_business_info has no UPDATE policy, so every
 * save matched zero rows, and the form still demanded a phone and email it never stored and
 * showed the failure in green with a tick. Owners cannot edit the directory the ingestion
 * pipeline owns, so corrections go through the listing request form, which a person reads.
 * There are no opening hours: the directory has no hours column.
 */
export default function BusinessProfilePage() {
  const { state } = useBusinessAuth()
  const businessId = state.owner?.businessId
  const [business, setBusiness] = useState<BusinessRow | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!businessId) return
    getBusinessByIdAction(Number(businessId)).then((result) => {
      if (result.success && result.business) setBusiness(result.business)
      else setError(result.error ?? 'Could not load your listing.')
    })
  }, [businessId])

  // The dashboard layout renders its own screen for an account with no approved business.
  if (!businessId) return null

  const website = websiteHref(business?.website)
  const phone = business?.phone ? formatPhone(business.phone) : null
  const rows: { label: string; value: React.ReactNode }[] = business
    ? [
        { label: 'Name', value: business.name },
        { label: 'Address', value: business.address },
        { label: 'City', value: business.city },
        {
          label: 'Phone',
          value: phone && (
            <a
              href={telHref(business.phone) ?? undefined}
              className="underline"
            >
              {phone}
            </a>
          ),
        },
        {
          label: 'Website',
          value: website && (
            <a
              href={website}
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              {displayWebsite(business.website)}
            </a>
          ),
        },
      ]
    : []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
          Your listing
        </h1>
        <p className="text-text-secondary mt-1">
          What customers see once they claim one of your deals. You can&apos;t
          edit it here.
        </p>
      </div>

      <Card variant="glass" padding="lg">
        {error ? (
          <p
            role="alert"
            className="flex items-center gap-2 text-sm text-error-text"
          >
            <WarningCircle size={18} weight="light" aria-hidden="true" />
            {error}
          </p>
        ) : !business ? (
          <p className="text-sm text-text-secondary">Loading your listing…</p>
        ) : (
          <dl className="divide-y divide-border-default">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-1 sm:grid-cols-3 gap-1 py-3"
              >
                <dt className="text-sm text-text-secondary">{row.label}</dt>
                <dd className="sm:col-span-2 text-sm text-text-primary break-words">
                  {row.value || (
                    <span className="text-text-muted">Not listed</span>
                  )}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Card>

      <Card variant="glass" padding="lg">
        <h2 className="font-display font-semibold text-text-primary tracking-tight">
          Something wrong or missing?
        </h2>
        <p className="text-sm text-text-secondary mt-1 mb-4">
          Send us a correction. A person reviews every request.
        </p>
        <Link
          href={`/business/listing-request?type=correct&business=${encodeURIComponent(businessId)}`}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-md text-sm font-semibold bg-accent text-white hover:bg-accent-hover transition-colors"
        >
          Request a correction
          <ArrowRight size={16} weight="bold" aria-hidden="true" />
        </Link>
      </Card>
    </div>
  )
}
