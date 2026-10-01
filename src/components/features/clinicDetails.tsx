import {
  Globe,
  MapPin,
  NavigationArrow,
  Phone,
  Star,
} from '@phosphor-icons/react'
import {
  addressLine,
  displayWebsite,
  mapsUrlForAddress,
  telHref,
  websiteHref,
} from '@/lib/utils/contactLinks'
import { formatPhone } from '@/lib/utils/phone'
import type { ClaimClinic } from '@/types/claim'

// Button's pill, as a link: tel:, the clinic's site and Maps are navigations, not actions.
const pill =
  'inline-flex items-center justify-center gap-2 rounded-full px-4 min-h-[44px] text-sm font-medium transition-colors duration-200'
const primaryPill = `${pill} bg-accent hover:bg-accent-hover text-white font-semibold`
const secondaryPill = `${pill} bg-bg-elevated hover:bg-bg-surface border border-border-default hover:border-border-hover text-text-primary`

interface ClinicDetailsProps {
  clinic: ClaimClinic
  /** Call / website / directions as buttons. Off for compact lists, which get plain links. */
  actions?: boolean
}

/**
 * What a claim reveals, the same way everywhere it is shown: deal page, claims page, dashboard.
 * The phone is the point of the exchange; its absence is said out loud rather than left blank.
 */
export function ClinicDetails({ clinic, actions = true }: ClinicDetailsProps) {
  const address = addressLine(clinic.address, clinic.city)
  const tel = telHref(clinic.phone)
  const site = websiteHref(clinic.website)
  const maps = mapsUrlForAddress(address)

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-lg font-semibold text-text-primary">
          {clinic.name}
        </p>
        {clinic.rating != null && (
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-text-secondary">
            <Star size={14} weight="fill" className="text-accent-graphic" />
            {clinic.rating.toFixed(1)} Google rating
            {clinic.review_count ? (
              <span className="text-text-muted">
                ({clinic.review_count.toLocaleString('en-US')} reviews)
              </span>
            ) : null}
          </p>
        )}
      </div>

      <ul className="space-y-2 text-sm">
        {address && (
          <li className="flex items-start gap-2 text-text-secondary">
            <MapPin size={18} className="mt-0.5 shrink-0 text-text-muted" />
            <span>{address}</span>
          </li>
        )}
        {tel && clinic.phone && (
          <li className="flex items-center gap-2">
            <Phone size={18} className="shrink-0 text-text-muted" />
            <a
              href={tel}
              className="text-accent hover:text-accent-hover transition-colors"
            >
              {formatPhone(clinic.phone)}
            </a>
          </li>
        )}
        {site && (
          <li className="flex items-center gap-2 min-w-0">
            <Globe size={18} className="shrink-0 text-text-muted" />
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-accent hover:text-accent-hover transition-colors"
            >
              {displayWebsite(site)}
            </a>
          </li>
        )}
        {!actions && maps && (
          <li className="flex items-center gap-2">
            <NavigationArrow size={18} className="shrink-0 text-text-muted" />
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:text-accent-hover transition-colors"
            >
              Get directions
            </a>
          </li>
        )}
      </ul>

      {!tel && !site && (
        <p className="text-sm text-text-muted">
          We don&apos;t have a phone number or website on file for this clinic,
          so our team passes your request on to them.
        </p>
      )}

      {actions && (tel || site || maps) && (
        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={tel} className={primaryPill}>
              <Phone size={18} weight="bold" />
              Call now
            </a>
          )}
          {site && (
            <a
              href={site}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryPill}
            >
              <Globe size={18} weight="bold" />
              Visit website
            </a>
          )}
          {maps && (
            <a
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
              className={secondaryPill}
            >
              <NavigationArrow size={18} weight="bold" />
              Get directions
            </a>
          )}
        </div>
      )}
    </div>
  )
}
