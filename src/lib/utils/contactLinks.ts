/**
 * Links a customer uses to act on a revealed clinic. Built from the directory columns the
 * pipeline actually fills (address 418/419, website 415/419) rather than the Google place id
 * (197/419), so every reveal gets a directions link and a clean website link.
 */

/** Google Maps search for a street address; `null` when there is nothing to search for. */
export function mapsUrlForAddress(
  address: string | null | undefined,
  city?: string | null,
): string | null {
  const query = [address, city].filter(Boolean).join(', ').trim()
  if (!query) return null
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`
}

function parseUrl(url: string | null | undefined): URL | null {
  if (!url) return null
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`)
  } catch {
    return null
  }
}

/** The clinic's site without the tracking codes the scraper picked up (`?utm_source=gmb`). */
export function websiteHref(url: string | null | undefined): string | null {
  const parsed = parseUrl(url)
  if (!parsed) return null
  parsed.search = ''
  parsed.hash = ''
  return parsed.toString()
}

/** What to print for a website link: the bare host, "dermfx.com". */
export function displayWebsite(url: string | null | undefined): string | null {
  const parsed = parseUrl(url)
  return parsed ? parsed.hostname.replace(/^www\./, '') : null
}

/** `tel:` href for an E.164 or loosely formatted number; `null` when there are no digits. */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/[^\d+]/g, '')
  return digits ? `tel:${digits}` : null
}

/**
 * The street address with the city printed once. 369 of 395 addresses already end in their
 * city ("…, Tucson, AZ 85718"), so appending `city` printed it twice.
 */
export function addressLine(
  address: string | null | undefined,
  city?: string | null,
): string | null {
  const street = address?.trim()
  const town = city?.trim()
  if (!street) return town || null
  if (!town || street.toLowerCase().includes(town.toLowerCase())) return street
  return `${street}, ${town}`
}
