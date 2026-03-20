'use client'

import { DeviceMobile, EnvelopeSimple, Warning } from '@phosphor-icons/react'
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
  return (
    <div className="flex items-start gap-4 py-3">
      <div className="flex-shrink-0 p-2 rounded-lg bg-[#f2ebe2] text-amber-800">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium text-[#451a03] cursor-pointer">
            {label}
          </label>
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`
              relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full
              border-2 border-transparent transition-colors duration-200 ease-in-out
              focus:outline-none focus:ring-2 focus:ring-amber-800 focus:ring-offset-2 focus:ring-offset-[#e8ddd0]
              ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
              ${checked ? 'bg-amber-800' : 'bg-[#faf5ee]'}
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
        <p className="mt-1 text-sm text-[#78350f]">{description}</p>
      </div>
    </div>
  )
}

export function AlertPreferences() {
  const { state, updateAlertPreferences } = useAuth()
  const { user } = state

  if (!user) return null

  const handleEmailToggle = (checked: boolean) => {
    updateAlertPreferences(checked, user.alertsSms)
  }

  const handleSmsToggle = (checked: boolean) => {
    updateAlertPreferences(user.alertsEmail, checked)
  }

  const isPhoneVerified = !!user.phoneVerifiedAt

  return (
    <div className="space-y-2 divide-y divide-[#d4c4b0]">
      <ToggleSwitch
        checked={user.alertsEmail}
        onChange={handleEmailToggle}
        label="Email notifications"
        description="Receive deal alerts and claim updates via email"
        icon={<EnvelopeSimple size={20} weight="duotone" />}
      />

      <div className="pt-2">
        <ToggleSwitch
          checked={user.alertsSms}
          onChange={handleSmsToggle}
          disabled={!isPhoneVerified}
          label="SMS notifications"
          description={
            isPhoneVerified
              ? 'Receive deal alerts via text message'
              : 'Add and verify your phone to enable SMS notifications'
          }
          icon={<DeviceMobile size={20} weight="duotone" />}
        />
        {!isPhoneVerified && (
          <div className="ml-12 mt-1 flex items-center gap-2 text-amber-500">
            <Warning size={16} weight="fill" />
            <span className="text-xs">Phone verification required</span>
          </div>
        )}
      </div>
    </div>
  )
}
