export function toExternalUrl(value: string | null | undefined): URL | null {
  const raw = value?.trim()
  if (!raw) return null

  try {
    const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    const url = new URL(candidate)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch {
    return null
  }
}

export function outboundEntryPoint(value: string | null): string {
  return value?.trim().slice(0, 100) || 'marketplace'
}
