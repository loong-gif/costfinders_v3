'use client'

import { ChartBar } from '@phosphor-icons/react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BillingHistory } from '@/components/features/billingHistory'
import { LeadBalanceCard } from '@/components/features/leadBalanceCard'
import { LeadCostCard } from '@/components/features/leadCostCard'
import { LeadPackagesGrid } from '@/components/features/leadPackagesGrid'

const LeadPurchaseModal = dynamic(
  () =>
    import('@/components/features/leadPurchaseModal').then(
      (m) => m.LeadPurchaseModal,
    ),
  { ssr: false },
)

import { PaymentMethods } from '@/components/features/paymentMethods'
import { PricingHubHeader } from '@/components/features/pricingHubHeader'
import { Card } from '@/components/ui/card'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getInvoices, getPaymentMethods } from '@/lib/mock-data/billing'
import { getBusinessById } from '@/lib/mock-data/businesses'
import {
  type BusinessCredits,
  type BusinessTier,
  type CreditPackage,
  getBusinessCredits,
  getCreditPackages,
  getCreditUsageHistory,
  getLeadPricing,
} from '@/lib/mock-data/leadPricing'

export default function PricingHubPage() {
  const router = useRouter()
  const { state } = useBusinessAuth()
  const business = state.owner?.businessId
    ? getBusinessById(state.owner.businessId)
    : null

  // Get current tier from business, default to 'free'
  const currentTier: BusinessTier = business?.tier === 'paid' ? 'paid' : 'free'

  // State
  const [credits, setCredits] = useState<BusinessCredits>(getBusinessCredits())
  const [selectedPackage, setSelectedPackage] = useState<CreditPackage | null>(
    null,
  )
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
    alert(`Invoice ${invoiceId} would be downloaded in production`)
  }

  const handleAddPaymentMethod = () => {
    alert(
      'In production, this would open a secure payment form to add a new card',
    )
  }

  const handleRemovePaymentMethod = (_id: string) => {}

  const handleSetDefaultPaymentMethod = (_id: string) => {}

  // Get max usage for chart scaling
  const maxUsage = Math.max(...usageHistory.map((h) => h.used), 1)

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">Pricing</h1>
        <p className="text-[#78350f] mt-1">
          Manage your plan, lead costs, and billing
        </p>
      </div>

      {/* Section 1: Current Plan Overview */}
      <PricingHubHeader currentTier={currentTier} onUpgrade={handleUpgrade} />

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
            document
              .getElementById('lead-packages')
              ?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      </div>

      {/* Usage Chart */}
      <Card variant="glass" padding="lg">
        <div className="flex items-center gap-2 mb-6">
          <ChartBar size={20} weight="fill" className="text-amber-800" />
          <h2 className="text-lg font-semibold text-[#451a03]">
            Lead usage history
          </h2>
        </div>

        <div className="flex items-end gap-2 h-32">
          {usageHistory.map((month) => (
            <div
              key={month.month}
              className="flex-1 flex flex-col items-center gap-2"
            >
              <div className="w-full flex flex-col items-center justify-end h-24">
                <div
                  className="w-full max-w-[40px] bg-amber-800/80 rounded-t-lg transition-all duration-300"
                  style={{
                    height: `${(month.used / maxUsage) * 100}%`,
                    minHeight: month.used > 0 ? '8px' : '0px',
                  }}
                />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-[#451a03]">
                  {month.used}
                </p>
                <p className="text-xs text-[#92400e]">{month.month}</p>
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
        <h2 className="text-xl font-bold text-[#451a03]">Billing & payment</h2>

        {currentTier === 'paid' ? (
          <>
            {/* Billing Summary */}
            <Card variant="glass" padding="lg">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-[#92400e] uppercase tracking-wide mb-1">
                    Current plan
                  </p>
                  <p className="text-lg font-semibold text-[#451a03]">
                    Professional
                  </p>
                  <p className="text-sm text-[#78350f]">$99/month</p>
                </div>
                <div>
                  <p className="text-xs text-[#92400e] uppercase tracking-wide mb-1">
                    Next billing date
                  </p>
                  <p className="text-lg font-semibold text-[#451a03]">
                    Feb 15, 2025
                  </p>
                  <p className="text-sm text-[#78350f]">Auto-renewal enabled</p>
                </div>
                <div>
                  <p className="text-xs text-[#92400e] uppercase tracking-wide mb-1">
                    Payment method
                  </p>
                  <p className="text-lg font-semibold text-[#451a03]">
                    Visa ****4242
                  </p>
                  <p className="text-sm text-[#78350f]">Expires 12/27</p>
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
            <p className="text-[#78350f]">
              You&apos;re on the Free plan. Upgrade to Professional to access
              billing features and subscription management.
            </p>
            <button
              type="button"
              onClick={handleUpgrade}
              className="mt-4 py-2.5 px-6 bg-amber-800 hover:bg-amber-500 text-white rounded-xl text-sm font-semibold transition-colors"
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
