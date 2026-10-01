/**
 * A claim's preferred date is a calendar date ('YYYY-MM-DD'), not an instant. `new Date(str)`
 * parses that shape as UTC midnight, which renders a day early everywhere west of Greenwich —
 * the customer picked 2 October and the admin and the clinic read 1 October. Every surface
 * that prints a date-only column goes through here so the day never shifts.
 */
export function formatDateOnly(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  },
  locale = 'en-US',
): string {
  if (!value) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (!match) return value
  const [, year, month, day] = match
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return new Intl.DateTimeFormat(locale, options).format(date)
}
