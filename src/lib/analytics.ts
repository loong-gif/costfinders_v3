'use client'

import { track } from '@vercel/analytics'

type AnalyticsEvent =
  | 'deal_claimed'
  | 'deal_saved'
  | 'deal_unsaved'
  | 'auth_signup'
  | 'auth_signin'
  | 'filter_applied'
  | 'category_selected'

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
) {
  track(event, properties)
}
