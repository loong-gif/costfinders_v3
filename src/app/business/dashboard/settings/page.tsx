'use client'

import { Bell, CaretRight, CheckCircle, User } from '@phosphor-icons/react'
import Link from 'next/link'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

// Integrations (four "Coming Soon" tiles and a notify-me box that saved nothing) and Plan &
// billing (a planned $99 plan nobody has priced) are gone. Pricing is an owner decision; until
// it is made the only true statement is the one below.

// ponytail: exactly the mail that goes out today, and nothing else. The lead email is sent when
// our team relays a claim (an admin session); the new-message email in ownerNotifications.ts
// cannot send until a server-side sending identity exists, so it is not promised here. There are
// no per-business switches; the unsubscribe link in every email is the off switch.
const activeNotifications = [
  {
    label: 'New lead',
    description:
      'Email when our team passes a customer’s claim on one of your deals to you, with their preferred date and time',
  },
  {
    label: 'In-app notifications',
    description: 'Shown under the bell icon in the header',
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <Link href="/business/dashboard/profile" className="block">
        <Card className="p-5 transition-all duration-200 hover:bg-bg-elevated cursor-pointer">
          <div className="flex items-center gap-4">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-bg-surface flex items-center justify-center">
              <User size={24} weight="light" className="text-text-secondary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-display font-semibold text-text-primary">
                Your listing
              </h3>
              <p className="text-sm text-text-secondary mt-0.5">
                See your business details and request a correction
              </p>
            </div>
            <CaretRight
              size={20}
              weight="light"
              className="text-text-muted flex-shrink-0"
            />
          </div>
        </Card>
      </Link>

      <p className="text-sm text-text-secondary">
        CostFinders is free for listed businesses.
      </p>

      {/* Notifications */}
      <Card variant="glass" padding="lg">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-bg-surface flex items-center justify-center flex-shrink-0">
              <Bell
                size={20}
                weight="duotone"
                className="text-text-secondary"
              />
            </div>
            <div className="min-w-0">
              <CardTitle>Notifications</CardTitle>
              <CardDescription>What we send you</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div>
            {activeNotifications.map((item) => (
              <div
                key={item.label}
                className="flex items-start gap-3 py-3 border-b border-border-default last:border-b-0"
              >
                <CheckCircle
                  size={20}
                  weight="fill"
                  className="text-text-secondary flex-shrink-0 mt-0.5"
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {item.label}
                  </p>
                  <p className="text-sm text-text-secondary mt-0.5">
                    {item.description}
                  </p>
                </div>
              </div>
            ))}
            <p className="text-xs text-text-muted mt-4">
              Emails go to the address you sign in with. To stop them, use the
              unsubscribe link at the bottom of any of them.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
