'use client'

import { DeviceMobile, EnvelopeSimple, Warning } from '@phosphor-icons/react'
import { useId } from 'react'
import { useAuth } from '@/lib/context/authContext'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description: string
  icon: React.ReactNode
}

function ToggleSwitch({
  checked,
  onChange,
  disabled,
  label,
  description,
  icon,
}: ToggleSwitchProps) {
  // Rendered more than once per page, so the id must be instance-scoped
  const labelId = useId()

  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex-shrink-0 p-2 rounded-lg bg-bg-surface text-accent">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          {/* Not a <label>: the control is a button, so it is named with
              aria-labelledby instead */}
          <span
            id={labelId}
            className="text-sm font-medium text-text-primary cursor-pointer"
          >
            {label}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-labelledby={labelId}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
              border-2 border-transparent transition-colors duration-200 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-border-accent focus:ring-offset-2 focus:ring-offset-bg-base
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${checked ? 'bg-accent' : 'bg-bg-elevated'}
            `}
          >
            <span
              aria-hidden="true"
              className={`
                pointer-events-none inline-block h-5 w-5 transform rounded-full
                bg-white shadow ring-0 transition duration-200 ease-in-out
                ${checked ? 'translate-x-5' : 'translate-x-0'}
              `}
            />
          </button>
        </div>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>
    </div>
  )
}

export function AlertPreferences() {
  const { state, updateAlertPreferences } = useAuth()
  const { user } = state

  if (!user) return null

  // Always send SMS = false, never user.alertsSms. The server rejects any request that
  // asks for SMS, so echoing a stored `true` back — which a user could have set directly
  // through PostgREST — would make the email toggle permanently un-saveable.
  const handleEmailToggle = (checked: boolean) => {
    updateAlertPreferences(checked, false)
  }

  return (
    <div className="space-y-2 divide-y divide-border-default">
      <ToggleSwitch
        checked={user.alertsEmail}
        onChange={handleEmailToggle}
        label="Email notifications"
        description="Receive claim updates by email"
        icon={<EnvelopeSimple size={20} weight="duotone" />}
      />

      <div className="pt-2">
        <ToggleSwitch
          checked={false}
          onChange={() => {
            /* SMS alerts are not available; the toggle is disabled. */
          }}
          disabled
          label="SMS notifications"
          description="SMS notifications aren't available"
          icon={<DeviceMobile size={20} weight="duotone" />}
        />
        {/* "Coming soon" was a commitment nobody has made — there is no SMS
            provider anywhere in src/. State the fact instead. */}
        <div className="ml-12 mt-1 flex items-center gap-2 text-warning">
          <Warning size={16} weight="fill" aria-hidden="true" />
          <span className="text-xs">Not available</span>
        </div>
      </div>
    </div>
  )
}
