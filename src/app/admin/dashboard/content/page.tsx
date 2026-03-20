'use client'

import Link from 'next/link'
import { Tag, MapPin, FirstAidKit, CaretRight } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { getCategories } from '@/lib/mock-data/categories'
import { cities, locationAreas } from '@/lib/mock-data/locations'
import { getTreatments } from '@/lib/mock-data/treatments'

const contentLinks = [
  {
    title: 'Categories',
    description: 'Manage treatment categories',
    href: '/admin/dashboard/content/categories',
    icon: Tag,
    getCount: () => getCategories().length,
  },
  {
    title: 'Locations',
    description: 'Manage service areas and cities',
    href: '/admin/dashboard/content/locations',
    icon: MapPin,
    getCount: () => cities.length,
  },
  {
    title: 'Treatments',
    description: 'Manage treatment types',
    href: '/admin/dashboard/content/treatments',
    icon: FirstAidKit,
    getCount: () => getTreatments().length,
  },
]

export default function ContentManagementPage() {
  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">
            {getCategories().filter((c) => c.isActive).length}
          </p>
          <p className="text-sm text-stone-400">Active Categories</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">
            {cities.filter((c) => c.isActive).length}
          </p>
          <p className="text-sm text-stone-400">Active Cities</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-stone-100">{locationAreas.length}</p>
          <p className="text-sm text-stone-400">Service Areas</p>
        </Card>
      </div>

      {/* Content Section Cards */}
      <div className="grid gap-4">
        {contentLinks.map((link) => {
          const Icon = link.icon
          const count = link.getCount()

          return (
            <Link key={link.title} href={link.href}>
              <Card
                className="p-5 transition-all duration-200 hover:bg-stone-800 cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-400/10 flex items-center justify-center">
                    <Icon size={24} weight="light" className="text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-stone-100">{link.title}</h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-stone-900 text-stone-400">
                        {count} items
                      </span>
                    </div>
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
