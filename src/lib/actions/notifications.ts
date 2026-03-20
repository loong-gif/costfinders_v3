'use server'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ClaimNotificationData {
  consumerName: string
  consumerEmail: string
  dealTitle: string
  businessName: string
  businessCity: string
  preferredDate?: string
  preferredTime?: string
  notes?: string
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const RESEND_API_KEY = process.env.RESEND_API_KEY
const OPS_EMAIL =
  process.env.CLAIM_NOTIFICATION_EMAIL ?? 'leads@costfinders.com'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Send a lead notification email when a consumer claims a deal.
 *
 * Phase 1 behavior:
 * - If RESEND_API_KEY is set, sends via Resend to the ops inbox.
 * - If not configured, logs the notification to console and returns success.
 *
 * This is best-effort — callers should NOT fail if this throws.
 */
export async function sendClaimNotificationEmail(
  data: ClaimNotificationData,
): Promise<{ success: boolean; error?: string }> {
  const {
    consumerName,
    consumerEmail,
    dealTitle,
    businessName,
    businessCity,
    preferredDate,
    preferredTime,
    notes,
  } = data

  // Build the notification content
  const lines = [
    `New claim received:`,
    ``,
    `Consumer: ${consumerName} (${consumerEmail})`,
    `Deal: ${dealTitle}`,
    `Business: ${businessName}`,
    `City: ${businessCity}`,
  ]

  if (preferredDate) {
    lines.push(`Preferred Date: ${preferredDate}`)
  }
  if (preferredTime) {
    lines.push(`Preferred Time: ${preferredTime}`)
  }
  if (notes) {
    lines.push(`Notes: ${notes}`)
  }

  const textBody = lines.join('\n')

  // -----------------------------------------------------------------------
  // If no email service configured, log and exit
  // -----------------------------------------------------------------------
  if (!RESEND_API_KEY) {
    console.log(
      '[notifications] RESEND_API_KEY not configured — logging lead notification:',
    )
    console.log(textBody)
    return { success: true }
  }

  // -----------------------------------------------------------------------
  // Send via Resend API
  // -----------------------------------------------------------------------
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'CostFinders <notifications@costfinders.com>',
        to: [OPS_EMAIL],
        subject: `New Claim: ${dealTitle} — ${businessName} (${businessCity})`,
        text: textBody,
        html: buildHtmlEmail(data),
      }),
    })

    if (!response.ok) {
      const body = await response.text()
      console.error('[notifications] Resend API error:', response.status, body)
      return { success: false, error: `Resend API ${response.status}` }
    }

    return { success: true }
  } catch (err) {
    console.error('[notifications] Failed to send email:', err)
    return { success: false, error: String(err) }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildHtmlEmail(data: ClaimNotificationData): string {
  const {
    consumerName,
    consumerEmail,
    dealTitle,
    businessName,
    businessCity,
    preferredDate,
    preferredTime,
    notes,
  } = data

  const rows = [
    row('Consumer', `${esc(consumerName)} (${esc(consumerEmail)})`),
    row('Deal', esc(dealTitle)),
    row('Business', esc(businessName)),
    row('City', esc(businessCity)),
  ]

  if (preferredDate) rows.push(row('Preferred Date', esc(preferredDate)))
  if (preferredTime) rows.push(row('Preferred Time', esc(preferredTime)))
  if (notes) rows.push(row('Notes', esc(notes)))

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a1a;">New Deal Claim</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${rows.join('')}
      </table>
      <p style="margin-top: 24px; color: #666; font-size: 13px;">
        Sent by CostFinders Lead Notification System
      </p>
    </div>
  `.trim()
}

function row(label: string, value: string): string {
  return `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; font-weight: 600; color: #333; white-space: nowrap; vertical-align: top;">${label}</td>
      <td style="padding: 8px 12px; border-bottom: 1px solid #eee; color: #555;">${value}</td>
    </tr>`
}

function esc(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
