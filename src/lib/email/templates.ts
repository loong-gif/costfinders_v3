// ---------------------------------------------------------------------------
// Email Templates — Price Engine
// ---------------------------------------------------------------------------
// Plain HTML string builders. No external dependencies.
// Colors are the Price Engine tokens as literals (email clients read no CSS variables):
// #f4f5f7 page, white card, #0b1220 ink text, #5f6979 muted, #cc3714 coral button and links
// (5.09:1 under white text), #ff5a36 only for the wordmark's dot.

import { COMPANY_FACTS } from '@/lib/legal/companyFacts'
import { getSiteOrigin } from '@/lib/siteUrl'
import {
  addressLine,
  displayWebsite,
  mapsUrlForAddress,
  telHref,
  websiteHref,
} from '@/lib/utils/contactLinks'
import { formatPhone } from '@/lib/utils/phone'
import type { ClaimClinic } from '@/types/claim'

const SITE_URL = getSiteOrigin()

/**
 * OWNER-BLOCKED — the one company fact this file needs and cannot invent.
 *
 * A valid physical postal address is required in commercial email by CAN-SPAM
 * (15 U.S.C. 7704(a)(5)) and by the Gmail/Yahoo bulk-sender rules. Only the owner has
 * it, and RULES.md forbids fabricating one, so while `postalAddress` is null the footer
 * omits the line entirely rather than shipping a placeholder to recipients. Fill it in
 * src/lib/legal/companyFacts.ts, the same fact the legal pages print.
 */
export const COMPANY_POSTAL_ADDRESS = COMPANY_FACTS.postalAddress ?? ''

/**
 * Default (untokenised) opt-out link. `sendEmail()` swaps this exact string for the
 * recipient's tokenised one-click URL, so the substitution is a plain string replace on
 * one known value — and if that never runs, the footer still points at a real page that
 * explains how to opt out instead of at a broken token.
 */
const UNSUBSCRIBE_URL = `${SITE_URL}/unsubscribe`

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Base Template
// ---------------------------------------------------------------------------

export function buildEmailHtml(options: {
  title: string
  bodyHtml: string
  ctaUrl?: string
  ctaText?: string
}): string {
  const { title, bodyHtml, ctaUrl, ctaText } = options

  const ctaBlock =
    ctaUrl && ctaText
      ? `
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin: 28px 0;">
        <tr>
          <td style="border-radius: 9999px; background-color: #cc3714;">
            <a href="${esc(ctaUrl)}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 9999px;">
              ${esc(ctaText)}
            </a>
          </td>
        </tr>
      </table>`
      : ''

  // Omitted while COMPANY_POSTAL_ADDRESS is empty. An absent line is honest; a
  // "[COMPANY ADDRESS]" line in a real recipient's inbox is not.
  const postalBlock = COMPANY_POSTAL_ADDRESS
    ? `<p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6979;">${esc(COMPANY_POSTAL_ADDRESS)}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f5f7; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f4f5f7;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <span style="font-size: 22px; font-weight: 700; color: #0b1220; letter-spacing: -0.5px;">CostFinders<span style="color: #ff5a36;">.</span></span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 32px 28px; border: 1px solid #e5e7eb;">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #0b1220; line-height: 1.3;">
                ${esc(title)}
              </h1>
              <div style="font-size: 15px; line-height: 1.6; color: #0b1220;">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 0 0 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #5f6979;">
                CostFinders &mdash; Compare MedSpa Prices
              </p>
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #5f6979;">
                You're receiving this because you have a CostFinders account.
              </p>
              ${postalBlock}
              <p style="margin: 0; font-size: 12px; color: #5f6979;">
                <a href="${UNSUBSCRIBE_URL}" style="color: #cc3714; text-decoration: underline;">Unsubscribe from email notifications</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Specific Templates
// ---------------------------------------------------------------------------

/**
 * The customer's copy of what their claim revealed: the clinic's name, address, phone, website
 * and a directions link. createClaimAction sends it `essential`, because the phone number is
 * what the claim was for and an email opt-out must not swallow it.
 *
 * At launch no clinic has an account and nothing reaches a clinic automatically; our team relays
 * each claim by hand. So "what happens next" is the customer calling the clinic, never waiting
 * for a callback. tests/unit/emailCompliance.test.ts pins both halves.
 */
export function claimConfirmationEmail(data: {
  firstName?: string | null
  dealTitle: string
  priceLabel?: string | null
  clinic: ClaimClinic | null
}): { subject: string; html: string } {
  const { dealTitle, priceLabel, clinic } = data
  const subject = `Your claim has been submitted — ${dealTitle}`
  const greeting = data.firstName?.trim() || 'there'

  const address = clinic ? addressLine(clinic.address, clinic.city) : null
  const tel = telHref(clinic?.phone)
  const site = websiteHref(clinic?.website)
  const maps = mapsUrlForAddress(address)
  const link = (href: string, text: string) =>
    `<a href="${esc(href)}" style="color: #cc3714; text-decoration: underline;">${esc(text)}</a>`

  const clinicLines = clinic
    ? [
        `<strong>${esc(clinic.name)}</strong>`,
        address ? esc(address) : null,
        tel && clinic.phone ? link(tel, formatPhone(clinic.phone)) : null,
        site ? link(site, displayWebsite(site) ?? site) : null,
        maps ? link(maps, 'Get directions') : null,
      ].filter(Boolean)
    : []

  const clinicBlock = clinic
    ? `<div style="margin: 16px 0; padding: 16px; background-color: #f4f5f7; border-radius: 8px; line-height: 1.7;">${clinicLines.join('<br />')}</div>${
        !tel && !site
          ? `<p style="margin: 0 0 12px 0;">We don't have a phone number or website on file for this clinic, so our team will pass your request on.</p>`
          : ''
      }`
    : `<p style="margin: 0 0 12px 0;">The clinic's name, address and phone number are on your claims page.</p>`

  const priceLine = priceLabel
    ? `<p style="margin: 0 0 12px 0;">The CostFinders price: <strong>${esc(priceLabel)}</strong></p>`
    : ''

  const html = buildEmailHtml({
    title: 'Your claim has been submitted',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(greeting)},</p>
      <p style="margin: 0 0 12px 0;">
        You claimed <strong>${esc(dealTitle)}</strong>. Here is the clinic offering it.
      </p>
      ${clinicBlock}
      ${priceLine}
      <p style="margin: 0 0 4px 0;"><strong>What happens next:</strong></p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #0b1220;">
        <li style="margin-bottom: 6px;">Call or book with the clinic directly, and mention the CostFinders price.</li>
        <li style="margin-bottom: 6px;">Our team also passes your request on to the clinic.</li>
        <li style="margin-bottom: 6px;">Your claim and the clinic's details stay on your claims page.</li>
      </ul>`,
    ctaUrl: `${SITE_URL}/dashboard/claims`,
    ctaText: 'View your claims',
  })

  return { subject, html }
}

/**
 * Sent to a business owner when their business claim is approved. "Approved", never
 * "verified": the old ownership code went to the claimant's own inbox, which proved nothing.
 */
export function claimApprovalEmail(
  ownerName: string,
  businessName: string,
): { subject: string; html: string } {
  const subject = `Your business claim has been approved — ${businessName}`

  const html = buildEmailHtml({
    title: 'Your business claim has been approved',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(ownerName)},</p>
      <p style="margin: 0 0 12px 0;">
        Your claim for <strong>${esc(businessName)}</strong> has been approved.
      </p>
      <p style="margin: 0 0 0 0;">
        Your business dashboard shows your listing, lets you edit your deals' wording and prices, and lists the leads our team passes on to you.
      </p>`,
    ctaUrl: `${SITE_URL}/business/dashboard`,
    ctaText: 'Go to your dashboard',
  })

  return { subject, html }
}

/**
 * Sent to a business owner when their business claim is rejected.
 */
export function claimRejectionEmail(
  ownerName: string,
  businessName: string,
): { subject: string; html: string } {
  const subject = `Update on your business claim — ${businessName}`

  const html = buildEmailHtml({
    title: 'Your business claim was not approved',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(ownerName)},</p>
      <p style="margin: 0 0 12px 0;">
        We couldn't approve your claim for <strong>${esc(businessName)}</strong>.
      </p>
      <p style="margin: 0 0 12px 0;">
        If you think this is a mistake, email us and tell us how you're connected to the business.
      </p>
      <p style="margin: 0;">
        <a href="mailto:support@costfinders.ai" style="color: #cc3714; text-decoration: underline;">support@costfinders.ai</a>
      </p>`,
  })

  return { subject, html }
}
