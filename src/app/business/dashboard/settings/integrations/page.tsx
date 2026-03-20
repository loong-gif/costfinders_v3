'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  CalendarBlank,
  Calendar,
  SquareLogo,
  Code,
  CheckCircle,
  EnvelopeSimple,
} from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const integrations = [
  {
    id: 'calendly',
    name: 'Calendly',
    description: 'Sync with your Calendly account for seamless scheduling',
    icon: CalendarBlank,
  },
  {
    id: 'acuity',
    name: 'Acuity Scheduling',
    description: 'Connect Acuity for appointment booking and management',
    icon: Calendar,
  },
  {
    id: 'square',
    name: 'Square Appointments',
    description: 'Integrate with Square booking and payment system',
    icon: SquareLogo,
  },
  {
    id: 'webhook',
    name: 'Custom Webhook',
    description: 'Set up custom integration via webhook for your existing systems',
    icon: Code,
  },
]

export default function IntegrationsPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleNotifySubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    setIsSubmitting(false)
    setSubmitted(true)
    setEmail('')

    // Reset success state after 5 seconds
    setTimeout(() => setSubmitted(false), 5000)
  }

  return (
    <div className="space-y-6">
      {/* Header with back link */}
      <div>
        <Link
          href="/business/dashboard/settings"
          className="inline-flex items-center gap-1 text-sm text-stone-400 hover:text-stone-100 transition-colors mb-4"
        >
          <ArrowLeft size={16} weight="light" />
          Back to Settings
        </Link>
        <h1 className="text-2xl font-bold text-stone-100">
          Scheduling Integrations
        </h1>
        <p className="text-stone-400 mt-1">
          Connect your scheduling software to automatically sync appointments from
          claimed deals.
        </p>
      </div>

      {/* Integrations grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {integrations.map((integration) => {
          const Icon = integration.icon
          return (
            <Card key={integration.id} className="p-5">
              <div className="flex flex-col h-full">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-stone-800 border border-stone-800 flex items-center justify-center">
                    <Icon size={24} weight="light" className="text-stone-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-stone-100">
                        {integration.name}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-medium bg-amber-400/10 text-amber-400 rounded-full">
                        Coming Soon
                      </span>
                    </div>
                    <p className="text-sm text-stone-400 mt-1">
                      {integration.description}
                    </p>
                  </div>
                </div>
                <div className="mt-auto">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled
                    className="w-full opacity-50 cursor-not-allowed"
                  >
                    Connect
                  </Button>
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Email signup */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
              <EnvelopeSimple size={24} weight="light" className="text-amber-400" />
            </div>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-stone-100">
              Get notified when integrations launch
            </h3>
            <p className="text-sm text-stone-400 mt-0.5">
              Be the first to know when we add support for your favorite scheduling
              tools.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="mt-4 flex items-center gap-2 text-green-500">
            <CheckCircle size={20} weight="fill" />
            <span className="text-sm">
              Thanks! We&apos;ll notify you when integrations are available.
            </span>
          </div>
        ) : (
          <form onSubmit={handleNotifySubmit} className="mt-4 flex gap-3">
            <div className="flex-1">
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                disabled={isSubmitting}
                required
              />
            </div>
            <Button type="submit" isLoading={isSubmitting} disabled={isSubmitting}>
              Notify Me
            </Button>
          </form>
        )}
      </Card>
    </div>
  )
}
