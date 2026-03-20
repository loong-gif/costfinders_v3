'use client'

import {
  CheckCircle,
  MagnifyingGlass,
  Plus,
  Storefront,
} from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BusinessSearchModal } from '@/components/features/businessSearchModal'
import { Button } from '@/components/ui/button'
import type { Business } from '@/types/business'

const valueProps = [
  {
    icon: CheckCircle,
    title: 'Claim Your Profile',
    description: 'Verify ownership and take control of your business listing',
  },
  {
    icon: CheckCircle,
    title: 'Manage Your Deals',
    description: 'Create and promote special offers to attract new customers',
  },
  {
    icon: CheckCircle,
    title: 'Connect with Customers',
    description: 'Receive leads and grow your medspa business',
  },
]

export default function BusinessPage() {
  const router = useRouter()
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false)

  const handleSelectBusiness = (business: Business) => {
    // Navigate to claim flow (built in 06-02)
    router.push(`/business/claim/${business.id}`)
  }

  const handleCreateNew = () => {
    // Navigate to create flow (built in 06-03)
    router.push('/business/create')
  }

  return (
    <main className="min-h-screen bg-bg-primary pt-20">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-brand-primary/5 via-transparent to-transparent" />

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
          <div className="text-center">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 mb-8">
              <Storefront size={40} weight="light" className="text-brand-primary" />
            </div>

            {/* Heading */}
            <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
              Are you a business owner?
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-12">
              Join CostFinders to showcase your medspa, manage deals, and connect
              with customers looking for your services.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setIsSearchModalOpen(true)}
                className="w-full sm:w-auto"
              >
                <MagnifyingGlass size={20} weight="light" className="mr-2" />
                Find My Business
              </Button>
              <Button
                variant="secondary"
                size="lg"
                onClick={handleCreateNew}
                className="w-full sm:w-auto"
              >
                <Plus size={20} weight="light" className="mr-2" />
                List a New Business
              </Button>
            </div>
          </div>

          {/* Value Propositions */}
          <div className="grid sm:grid-cols-3 gap-6">
            {valueProps.map((prop) => (
              <div
                key={prop.title}
                className="p-6 rounded-2xl border border-glass-border bg-glass-bg backdrop-blur-sm"
              >
                <prop.icon
                  size={24}
                  weight="fill"
                  className="text-success-text mb-4"
                />
                <h3 className="font-semibold text-text-primary mb-2">
                  {prop.title}
                </h3>
                <p className="text-sm text-text-secondary">{prop.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search Modal */}
      <BusinessSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        onSelect={handleSelectBusiness}
        onCreateNew={handleCreateNew}
      />
    </main>
  )
}
