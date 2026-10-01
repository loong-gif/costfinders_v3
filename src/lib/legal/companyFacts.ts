/**
 * The company facts the Privacy Policy, the Terms of Service and the email footer print.
 *
 * `null` means nobody has supplied the fact yet. The legal pages render it as a marked
 * "[to be supplied]", and they keep the "Draft, pending legal review" banner up while any
 * field is still null (`LEGAL_PAGES_ARE_DRAFT`). Never fill one with a guess: an invented
 * address or governing law on a published policy is worse than a visible blank, and RULES.md
 * forbids it. Each field names who supplies it.
 *
 * `false` means the owner decided to leave the fact out, where leaving it out is allowed.
 */
interface CompanyFacts {
  legalName: string | null
  entityType: string | null
  registeredState: string | null
  postalAddress: string | null
  phone: string | false | null
  contactEmail: string | null
  effectiveDate: string | null
  deletedAccountRetention: string | null
  claimRetention: string | null
  liabilityCap: string | null
  governingLawState: string | null
  venue: string | null
  arbitration: string | false | null
}

export const COMPANY_FACTS: CompanyFacts = {
  /** Owner. The registered legal name, as on the formation documents. */
  legalName: null,
  /** Owner. "limited liability company", "corporation"… */
  entityType: null,
  /** Owner. The state the entity is registered in. */
  registeredState: null,
  /** Owner. A postal address that reaches the company. Also printed in every email footer
   *  (CAN-SPAM), through COMPANY_POSTAL_ADDRESS in src/lib/email/templates.ts. */
  postalAddress: null,
  /** Owner, with counsel. A phone number for privacy requests, or `false` to publish none.
   *  Counsel to confirm whether email plus the web form is enough under the CCPA. */
  phone: null,
  /** Owner. Published on both pages. Mail to it reaches a person only once the forwarding in
   *  docs/OPERATIONS.md ("Mail routing: leads@ and support@") is set up. */
  contactEmail: 'support@costfinders.ai',
  /** Counsel. The date counsel signs off. Both pages take effect then, not when drafted. */
  effectiveDate: null,
  /** Owner. How long copies of a deleted account can survive in backups, e.g. "30 days".
   *  Deleting an account removes the live rows at once (delete_own_account()). */
  deletedAccountRetention: null,
  /** Owner. How long claims and messages of an open account are kept after the claim closes,
   *  e.g. "24 months". Nothing deletes them automatically today, so a value here is a promise
   *  that needs a scheduled delete behind it. */
  claimRetention: null,
  /** Owner, with counsel. The floor of the liability cap, e.g. "USD 100". */
  liabilityCap: null,
  /** Counsel. The state whose law governs the Terms. */
  governingLawState: null,
  /** Counsel. Courts for disputes, as "County, State". */
  venue: null,
  /** Counsel. The full arbitration and class-action-waiver clause, or `false` for none. */
  arbitration: null,
}

/** True while any fact is unsupplied. Drives the draft banner on /privacy and /terms. */
export const LEGAL_PAGES_ARE_DRAFT = Object.values(COMPANY_FACTS).includes(null)
