import type { Icon } from '@phosphor-icons/react'
import {
  Calculator,
  Drop,
  Eyedropper,
  Heartbeat,
  PersonSimple,
  Quotes,
  SealCheck,
  Sparkle,
  Sun,
  Syringe,
  Tag,
  WarningCircle,
} from '@phosphor-icons/react/dist/ssr'
import type { InterpretationTier, TreatmentCategory } from '@/types/deal'

/**
 * The icon per treatment, in place of a stock photo on every deal surface (owner decision,
 * 2026-09-28: we hold no clinic photos, and before a claim one would identify the clinic).
 * From the /ssr entry so server and client components can both render them.
 *
 * Keyed on every treatment, so a new one is a compile error here rather than a missing icon.
 */
export const TREATMENT_ICONS: Record<TreatmentCategory, Icon> = {
  botox: Syringe,
  fillers: Drop,
  facials: Sparkle,
  laser: Sun,
  skincare: Eyedropper,
  wellness: Heartbeat,
  body: PersonSimple,
}

/** For a deal that names no single treatment (a clinic-wide discount, an uncategorised offer). */
export const NO_TREATMENT_ICON: Icon = Tag

export function treatmentIcon(treatment: TreatmentCategory | null): Icon {
  return treatment ? TREATMENT_ICONS[treatment] : NO_TREATMENT_ICON
}

/**
 * The icon beside a tier's label (TIER_LABELS) on every surface that prints one — rows, tiles,
 * the price card, How we read this deal, /how-it-works — so a label looks the same everywhere.
 */
export const TIER_ICONS: Record<InterpretationTier, Icon> = {
  'as-advertised': Quotes,
  'worked-out': Calculator,
  check: WarningCircle,
}

/** Beside "Confirmed by the clinic", which replaces the tier label where it applies. */
export const CONFIRMED_ICON: Icon = SealCheck
