// ---------------------------------------------------------------------------
// Email Templates — Warm Sand Design
// ---------------------------------------------------------------------------
// Plain HTML string builders. No external dependencies.
// Colors: #faf5ee background, #451a03 text, #92400e accent, white card

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://costfinders.com'

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
          <td style="border-radius: 8px; background-color: #92400e;">
            <a href="${esc(ctaUrl)}" target="_blank" style="display: inline-block; padding: 12px 28px; font-size: 15px; font-weight: 600; color: #ffffff; text-decoration: none; border-radius: 8px;">
              ${esc(ctaText)}
            </a>
          </td>
        </tr>
      </table>`
      : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${esc(title)}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #faf5ee; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color: #faf5ee;">
    <tr>
      <td align="center" style="padding: 40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px;">

          <!-- Header -->
          <tr>
            <td style="padding: 0 0 24px 0;">
              <span style="font-size: 22px; font-weight: 700; color: #92400e; letter-spacing: -0.3px;">CostFinders</span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color: #ffffff; border-radius: 12px; padding: 32px 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
              <h1 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 700; color: #451a03; line-height: 1.3;">
                ${esc(title)}
              </h1>
              <div style="font-size: 15px; line-height: 1.6; color: #451a03;">
                ${bodyHtml}
              </div>
              ${ctaBlock}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 28px 0 0 0; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 13px; color: #78716c;">
                CostFinders &mdash; Compare MedSpa Prices
              </p>
              <p style="margin: 0; font-size: 12px; color: #a8a29e;">
                <a href="${SITE_URL}/unsubscribe" style="color: #92400e; text-decoration: underline;">Unsubscribe</a>
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
 * Sent to a consumer after they claim a deal.
 */
export function claimConfirmationEmail(
  consumerName: string,
  dealTitle: string,
  businessCity: string,
): { subject: string; html: string } {
  const subject = `Your claim has been submitted — ${dealTitle}`

  const html = buildEmailHtml({
    title: 'Your claim has been submitted',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(consumerName)},</p>
      <p style="margin: 0 0 12px 0;">
        We've received your claim for <strong>${esc(dealTitle)}</strong> in ${esc(businessCity)}.
      </p>
      <p style="margin: 0 0 4px 0;"><strong>What happens next:</strong></p>
      <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #451a03;">
        <li style="margin-bottom: 6px;">The business will be notified of your interest</li>
        <li style="margin-bottom: 6px;">You'll hear back within 1&ndash;2 business days</li>
        <li style="margin-bottom: 6px;">Track your claim status anytime from your dashboard</li>
      </ul>`,
    ctaUrl: `${SITE_URL}/dashboard/claims`,
    ctaText: 'View your claims',
  })

  return { subject, html }
}

/**
 * Sent to a business owner when their business claim is approved.
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
        Congratulations! Your claim for <strong>${esc(businessName)}</strong> has been verified and approved.
      </p>
      <p style="margin: 0 0 0 0;">
        You now have full access to your business dashboard where you can manage your profile, deals, and view customer leads.
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
        Unfortunately, we were unable to verify your claim for <strong>${esc(businessName)}</strong> at this time.
      </p>
      <p style="margin: 0 0 12px 0;">
        This may be due to incomplete documentation or a mismatch with our records. If you believe this was an error, please reach out to our support team and we'll be happy to help.
      </p>
      <p style="margin: 0;">
        <a href="mailto:support@costfinders.com" style="color: #92400e; text-decoration: underline;">support@costfinders.com</a>
      </p>`,
  })

  return { subject, html }
}

/**
 * Sent to a business owner when their deal is approved.
 */
export function dealApprovalEmail(
  ownerName: string,
  dealTitle: string,
): { subject: string; html: string } {
  const subject = `Your deal has been approved — ${dealTitle}`

  const html = buildEmailHtml({
    title: 'Your deal has been approved',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(ownerName)},</p>
      <p style="margin: 0 0 12px 0;">
        Your deal <strong>${esc(dealTitle)}</strong> has been reviewed and approved. It's now live on CostFinders and visible to consumers searching for MedSpa treatments.
      </p>
      <p style="margin: 0 0 0 0;">
        You can manage this deal and track claims from your business dashboard.
      </p>`,
    ctaUrl: `${SITE_URL}/business/dashboard/deals`,
    ctaText: 'View your deals',
  })

  return { subject, html }
}

/**
 * Sent to a business owner when their deal is rejected (needs changes).
 */
export function dealRejectionEmail(
  ownerName: string,
  dealTitle: string,
  notes?: string,
): { subject: string; html: string } {
  const subject = `Your deal needs changes — ${dealTitle}`

  const notesBlock = notes
    ? `
      <div style="margin: 16px 0; padding: 12px 16px; background-color: #fef3c7; border-radius: 8px; border-left: 3px solid #92400e;">
        <p style="margin: 0 0 4px 0; font-weight: 600; font-size: 13px; color: #92400e;">Reviewer notes:</p>
        <p style="margin: 0; font-size: 14px; color: #451a03;">${esc(notes)}</p>
      </div>`
    : ''

  const html = buildEmailHtml({
    title: 'Your deal needs changes',
    bodyHtml: `
      <p style="margin: 0 0 12px 0;">Hi ${esc(ownerName)},</p>
      <p style="margin: 0 0 12px 0;">
        Your deal <strong>${esc(dealTitle)}</strong> has been reviewed, but it needs some changes before it can go live.
      </p>
      ${notesBlock}
      <p style="margin: 0 0 0 0;">
        Please update the deal and resubmit it for review.
      </p>`,
    ctaUrl: `${SITE_URL}/business/dashboard/deals`,
    ctaText: 'Edit your deal',
  })

  return { subject, html }
}
