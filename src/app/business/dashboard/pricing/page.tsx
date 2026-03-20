'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChartBar } from '@phosphor-icons/react'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getBusinessById } from '@/lib/mock-data/businesses'
import { Card } from '@/components/ui/card'
import { PricingHubHeader } from '@/components/features/pricingHubHeader'
import { LeadCostCard } from '@/components/features/leadCostCard'
import { LeadBalanceCard } from '@/components/features/leadBalanceCard'
import { LeadPackagesGrid } from '@/components/features/leadPackagesGrid'
import { LeadPurchaseModal } from '@/components/features/leadPurchaseModal'
import { BillingHistory } from '@/components/features/billingHistory'
import { PaymentMethods } from '@/components/features/paymentMethods'
import {
  getLeadPricing,
  getCreditPackages,
  getBusinessCredits,
  getCreditUsageHistory,
  type CreditPackage,
  type BusinessCredits,
  type BusinessTier,
} from '@/lib/mock-data/leadPricing'
import { getInvoices, getPaymentMethods } from '@/lib/mock-data/billing'

export default function PricingHubPage() {
  const router = useRouter()
  const { state } = useBusinessAuth()
  const business = state.owner?.businessId
    ? getBusinessById(state.owner.businessId)
    : null

  // Get current tier from business, default to 'free'
  const currentTier: BusinessTier = (business?.tier === 'paid' ? 'paid' : 'free')

  // State
  const [credits, setCredits] = useState<BusinessCredits>(getBusinessCredits())
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  // Mock data
  const currentPricing = getLeadPricing(currentTier)
  const paidPricing = getLeadPricing('paid')
  const leadPackages = getCreditPackages()
  const usageHistory = getCreditUsageHistory()
  const invoices = getInvoices()
  const paymentMethods = getPaymentMethods()

  // Handlers
  const handleUpgrade = () => {
    router.push('/business/dashboard/settings/account/checkout')
  }

  const handleBuyLeads = (pkg: CreditPackage) => {
    setSelectedPackage(pkg)
    setIsModalOpen(true)
  }

  const handlePurchaseComplete = (newCredits: BusinessCredits) => {
    setCredits(newCredits)
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    console.log('Downloading invoice:', invoiceId)
    alert(`Invoice ${invoiceId} would be downloaded in production`)
  }

  const handleAddPaymentMethod = () => {
    alert('In production, this would open a secure payment form to add a new card')
  }

  const handleRemovePaymentMethod = (id: string) => {
    console.log('Removing payment method:', id)
  }

  const handleSetDefaultPaymentMethod = (id: string) => {
    console.log('Setting default payment method:', id)
  }

  // Get max usage for chart scaling
  const maxUsage = Math.max(...usageHistory.map((h) => h.used), 1)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-100">Pricing</h1>
        <p className="text-stone-400 mt-1">Manage your plan, lead costs, and billing</p>
      </div>

      {/* Section 1: Current Plan Overview */}
      <PricingHubHeader
        currentTier={currentTier}
        onUpgrade={handleUpgrade}
      />

      {/* Section 2 & 3: Lead Cost + Lead Balance */}
      <div className="grid lg:grid-cols-2 gap-6">
        <LeadCostCard
          currentTier={currentTier}
          currentPricing={currentPricing}
          paidPricing={paidPricing}
          onUpgrade={handleUpgrade}
        />

        <LeadBalanceCard
          credits={credits}
          usageHistory={usageHistory}
          onBuyMore={() => {
            document.getElementById('lead-packages')?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      </div>

      {/* Usage Chart */}
      <Card variant="glass" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <ChartBar size={20} weight="fill" className="text-amber-400" />
          <h2 className="text-lg font-semibold text-stone-100">Lead usage history</h2>
        </div>

        <div className="flex items-end gap-2 h-32">
          {usageHistory.map((month) => (
            <div key={month.month} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex flex-col items-center justify-end h-24">
                <div
                  className="w-full max-w-[40px] bg-amber-400/80 rounded-t-lg transition-all duration-300"
                  style={{
                    height: `${(month.used / maxUsage) * 100}%`,
                    minHeight: month.used > 0 ? '8px' : '0px',
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-stone-100">{month.used}</p>
                <p className="text-xs text-stone-500">{month.month}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Section 4: Buy More Leads */}
      <div id="lead-packages">
        <LeadPackagesGrid
          packages={leadPackages}
          onSelectPackage={handleBuyLeads}
        />
      </div>

      {/* Section 5: Billing & Payment (for paid tier or expandable for free) */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-stone-100">Billing & payment</h2>

        {currentTier === 'paid' ? (
          <>
            {/* Billing Summary */}
            <Card variant="glass" padding="lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Current plan
                  </p>
                  <p className="text-lg font-semibold text-stone-100">Professional</p>
                  <p className="text-sm text-stone-400">$99/month</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Next billing date
                  </p>
                  <p className="text-lg font-semibold text-stone-100">Feb 15, 2025</p>
                  <p className="text-sm text-stone-400">Auto-renewal enabled</p>
                </div>
                <div>
                  <p className="text-xs text-stone-500 uppercase tracking-wide mb-1">
                    Payment method
                  </p>
                  <p className="text-lg font-semibold text-stone-100">
                    Visa ****4242
                  </p>
                  <p className="text-sm text-stone-400">Expires 12/27</p>
                </div>
              </div>
            </Card>

            {/* Payment Methods */}
            <PaymentMethods
              paymentMethods={paymentMethods}
              onAddMethod={handleAddPaymentMethod}
              onRemoveMethod={handleRemovePaymentMethod}
              onSetDefault={handleSetDefaultPaymentMethod}
            />

            {/* Billing History */}
            <BillingHistory
              invoices={invoices}
              onDownload={handleDownloadInvoice}
            />
          </>
        ) : (
          <Card variant="glass" padding="lg">
            <p className="text-stone-400">
              You&apos;re on the Free plan. Upgrade to Professional to access billing features and subscription management.
            </p>
            <button
              type="button"
              onClick={handleUpgrade}
              className="mt-4 py-2.5 px-6 bg-amber-400 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
            >
              Upgrade to Professional
            </button>
          </Card>
        )}
      </div>

      {/* Purchase Modal */}
      <LeadPurchaseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedPackage={selectedPackage}
        currentBalance={credits}
        onPurchaseComplete={handlePurchaseComplete}
      />
    </div>
  )
}
