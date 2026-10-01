/** Mass nouns that end in "s" and still take a singular verb: "how much DOES wellness cost". */
const SINGULAR_ENDING_IN_S = new Set(['wellness'])

/**
 * Does this treatment label take a plural verb?
 *
 * The guide vocabulary is built around sentences like "how much DO dermal fillers COST" and
 * "what facials COST", against "how much DOES Botox COST" and "what microneedling COSTS".
 * Labels split on a trailing "s" — "Dermal Fillers", "Facials" and "Neurotoxins" are plural;
 * "Botox" and "Microneedling" are not — except the mass nouns listed above ("Wellness", a
 * treatment bucket since 2026-09-24).
 *
 * ponytail: a trailing-"s" test plus an exception list, not a pluralisation library.
 */
export function isPluralTreatment(label: string): boolean {
  const word = label.trim().toLowerCase()
  return word.endsWith('s') && !SINGULAR_ENDING_IN_S.has(word)
}

/** "do" / "does" to agree with the treatment label. */
export function treatmentDo(label: string): string {
  return isPluralTreatment(label) ? 'do' : 'does'
}

/** "cost" / "costs" to agree with the treatment label. */
export function treatmentCost(label: string): string {
  return isPluralTreatment(label) ? 'cost' : 'costs'
}
