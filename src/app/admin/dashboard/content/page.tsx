'use client'

import {
  CaretRight,
  FirstAidKit,
  MapPin,
  Spinner,
  Tag,
} from '@phosphor-icons/react'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { Card } from '@/components/ui/card'
import {
  type ContentCategory,
  type ContentLocation,
  getCategoriesAction,
  getLocationsAction,
} from '@/lib/actions/admin-content'

export default function ContentManagementPage() {
  const [categories, setCategories] = useState<ContentCategory[]>([])
  const [locations, setLocations] = useState<ContentLocation[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [catResult, locResult] = await Promise.all([
        getCategoriesAction(),
        getLocationsAction(),
      ])
      if (catResult.success && catResult.categories) {
        setCategories(catResult.categories)
      }
      if (locResult.success && locResult.locations) {
        setLocations(locResult.locations)
      }
      setIsLoading(false)
    }
    load()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner size={32} className="animate-spin text-amber-800" />
      </div>
    )
  }

  const activeCategories = categories.filter((c) => c.is_active).length
  const activeLocations = locations.filter((l) => l.is_active).length

  const contentLinks = [
    {
      title: 'Categories',
      description: 'Manage treatment categories',
      href: '/admin/dashboard/content/categories',
      icon: Tag,
      count: categories.length,
    },
    {
      title: 'Locations',
      description: 'Manage service areas and cities',
      href: '/admin/dashboard/content/locations',
      icon: MapPin,
      count: locations.length,
    },
    {
      title: 'Treatments',
      description: 'Manage treatment types',
      href: '/admin/dashboard/content/treatments',
      icon: FirstAidKit,
      count: 0,
    },
  ]

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-3 gap-4">
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">
            {activeCategories}
          </p>
          <p className="text-sm text-[#78350f]">Active Categories</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">{activeLocations}</p>
          <p className="text-sm text-[#78350f]">Active Locations</p>
        </Card>
        <Card variant="glass" padding="md">
          <p className="text-2xl font-bold text-[#451a03]">
            {locations.length}
          </p>
          <p className="text-sm text-[#78350f]">Total Locations</p>
        </Card>
      </div>

      {/* Content Section Cards */}
      <div className="grid gap-4">
        {contentLinks.map((link) => {
          const Icon = link.icon

          return (
            <Link key={link.title} href={link.href}>
              <Card className="p-5 transition-all duration-200 hover:bg-[#faf5ee] cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
                    <Icon size={24} weight="light" className="text-amber-800" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-[#451a03]">
                        {link.title}
                      </h3>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#f2ebe2] text-[#78350f]">
                        {link.count} items
                      </span>
                    </div>
                    <p className="text-sm text-[#78350f] mt-0.5">
                      {link.description}
                    </p>
                  </div>
                  <CaretRight
                    size={20}
                    weight="light"
                    className="text-[#92400e]"
                  />
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
