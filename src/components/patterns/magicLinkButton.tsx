'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

/**
 * The three states of a magic-link request, on every surface that offers one.
 *
 * One component rather than one per login form: the three login surfaces (consumer modal,
 * business landing page, admin portal) each need the same sending / sent / error handling, and
 * the sent copy in particular has to stay identical everywhere. It is worded to promise nothing
 * about whether the address has an account, because the actions behind it deliberately answer
 * the same way either way — see sendMagicLinkAction() in src/lib/actions/auth.ts. A surface that
 * drifted into "Link sent!" would hand back exactly the account-existence signal the server side
 * is built to withhold.
 *
 * Business-agnostic by construction: the action is a prop, so this stays in patterns/ and knows
 * nothing about which role is signing in.
 */

/** The shape every send action returns (AuthResult, structurally). */
interface SendResult {
  success: boolean
  error?: string
}

interface MagicLinkButtonProps {
  /** Address from the form's own email field. Empty is handled here, not by the caller. */
  email: string
  /** Server action to call. Consumer/business/admin each pass their own. */
  sendAction: (email: string) => Promise<SendResult>
  label?: string
  /** Set while the surrounding password form is submitting. */
  disabled?: boolean
  className?: string
}

const SENT_MESSAGE =
  "If that address has an account, we've sent a sign-in link. Check your inbox."
const NO_EMAIL_MESSAGE = 'Enter your email above first'
const FAILED_MESSAGE = "We couldn't send a sign-in link. Please try again."

export function MagicLinkButton({
  email,
  sendAction,
  label = 'Email me a sign-in link',
  disabled = false,
  className = '',
}: MagicLinkButtonProps) {
  const [isSending, setIsSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setError(null)
    setSent(false)

    if (!email.trim()) {
      setError(NO_EMAIL_MESSAGE)
      return
    }

    setIsSending(true)
    let result: SendResult
    try {
      result = await sendAction(email)
    } catch {
      // Rejected outright (offline, Next refusing the request). Without this the button
      // spun forever.
      result = { success: false }
    } finally {
      setIsSending(false)
    }

    if (result.success) {
      setSent(true)
    } else {
      // A refusal that reaches here is the throttle ("Too many attempts. Try again in N
      // minutes."), which is worth showing verbatim — it tells the caller to wait rather than
      // to retype. It cannot reveal whether the address exists: throttling runs before
      // Supabase is touched.
      setError(result.error ?? FAILED_MESSAGE)
    }
  }

  return (
    <div className={`space-y-3 ${className}`}>
      <Button
        type="button"
        variant="secondary"
        className="w-full"
        size="lg"
        onClick={handleClick}
        isLoading={isSending}
        disabled={disabled || isSending}
      >
        {label}
      </Button>

      {/* <output> rather than <p role="status">: same implicit role, and Biome's
          useSemanticElements rule prefers the native element. */}
      {sent && (
        <output className="block text-sm text-success bg-success-bg px-3 py-2 rounded-lg">
          {SENT_MESSAGE}
        </output>
      )}

      {error && (
        <p
          role="alert"
          className="text-sm text-error bg-error-bg px-3 py-2 rounded-lg"
        >
          {error}
        </p>
      )}
    </div>
  )
}
