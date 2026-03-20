'use client'

import Link from 'next/link'
import { User, Plugs, CreditCard, CaretRight } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'

const settingsLinks = [
  {
    title: 'Profile',
    description: 'Update your business information and details',
    href: '/business/dashboard/profile',
    icon: User,
  },
  {
    title: 'Integrations',
    description: 'Connect scheduling and booking software',
    href: '/business/dashboard/settings/integrations',
    icon: Plugs,
  },
  {
    title: 'Account',
    description: 'View subscription and billing',
    href: '/business/dashboard/settings/account',
    icon: CreditCard,
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {settingsLinks.map((link) => {
          const Icon = link.icon
          return (
            <Link key={link.title} href={link.href}>
              <Card className="p-5 transition-all duration-200 hover:bg-stone-800 cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
                    <Icon size={24} weight="light" className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-stone-100">{link.title}</h3>
                    <p className="text-sm text-stone-400 mt-0.5">
                      {link.description}
                    </p>
                  </div>
                  <CaretRight size={20} weight="light" className="text-stone-500" />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
