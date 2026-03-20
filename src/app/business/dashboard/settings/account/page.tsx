'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Crown, CheckCircle, CreditCard, ArrowRight, Warning } from '@phosphor-icons/react'
import { useBusinessAuth } from '@/lib/context/businessAuthContext'
import { getBusinessById } from '@/lib/mock-data/businesses'
import { getInvoices, getPaymentMethods } from '@/lib/mock-data/billing'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { BillingHistory } from '@/components/features/billingHistory'
import { PaymentMethods } from '@/components/features/paymentMethods'

export default function AccountSettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state } = useBusinessAuth()
  const business = state.owner?.businessId
    ? getBusinessById(state.owner.businessId)
    : null

  // Success message from checkout
  const [showUpgradeSuccess, setShowUpgradeSuccess] = useState(false)

  // Cancel subscription modal
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  // Mock data
  const invoices = getInvoices()
  const paymentMethods = getPaymentMethods()

  // Get current tier, default to 'free' for display if business exists
  const currentTier = business?.tier ?? 'free'

  // Check for upgrade success param
  useEffect(() => {
    if (searchParams.get('upgraded') === 'true') {
      setShowUpgradeSuccess(true)
      // Clear the param from URL
      const url = new URL(window.location.href)
      url.searchParams.delete('upgraded')
      window.history.replaceState({}, '', url.toString())
      // Auto-hide after 5 seconds
      setTimeout(() => setShowUpgradeSuccess(false), 5000)
    }
  }, [searchParams])

  const handleCancelSubscription = () => {
    setIsCancelling(true)
    // Simulate API call
    setTimeout(() => {
      setIsCancelling(false)
      setShowCancelModal(false)
      // In real app, this would update the tier
    }, 1500)
  }

  const handleDownloadInvoice = (invoiceId: string) => {
    // Mock download - in real app would fetch actual PDF
    console.log('Downloading invoice:', invoiceId)
    alert(`Invoice ${invoiceId} would be downloaded in production`)
  }

  const handleAddPaymentMethod = () => {
    // In real app, would open Stripe modal or redirect
    alert('In production, this would open a secure payment form to add a new card')
  }

  const handleRemovePaymentMethod = (id: string) => {
    // Mock removal - in real app would call API
    console.log('Removing payment method:', id)
  }

  const handleSetDefaultPaymentMethod = (id: string) => {
    // Mock set default - in real app would call API
    console.log('Setting default payment method:', id)
  }

  return (
    <div className="space-y-6">
      {/* Upgrade Success Message */}
      {showUpgradeSuccess && (
        <div className="flex items-center gap-3 p-4 bg-emerald-600/10 rounded-xl border border-emerald-400/20">
          <CheckCircle size={20} weight="fill" className="text-emerald-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-600">Subscription activated!</p>
            <p className="text-xs text-[#78350f] mt-0.5">
              You now have access to all Professional features.
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Status with Link to Pricing Hub */}
      <Card variant="glass" padding="lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <Crown
                size={28}
                weight={currentTier === 'paid' ? 'fill' : 'light'}
                className="text-amber-800"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-[#451a03]">
                  {currentTier === 'paid' ? 'Professional plan' : 'Free plan'}
                </h2>
                <Badge variant={currentTier === 'paid' ? 'brand' : 'default'} size="sm">
                  {currentTier === 'paid' ? 'Active' : 'Current'}
                </Badge>
              </div>
              <p className="text-sm text-[#78350f] mt-0.5">
                {currentTier === 'paid'
                  ? 'You have access to all premium features'
                  : 'Upgrade to unlock premium features'}
              </p>
            </div>
          </div>
          <Link
            href="/business/dashboard/pricing"
            className="flex items-center gap-2 py-2.5 px-4 bg-[#f2ebe2] hover:bg-[#faf5ee] border border-[#d4c4b0] rounded-xl text-sm font-medium text-[#451a03] transition-colors"
          >
            View pricing & plans
            <ArrowRight size={16} weight="bold" />
          </Link>
        </div>
      </Card>

      {/* Billing Section */}
      <div className="space-y-6">
        <h2 className="text-xl font-bold text-[#451a03]">Billing</h2>

        {/* Billing Summary for paid users */}
        {currentTier === 'paid' && (
          <Card variant="glass" padding="lg">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-[#92400e] uppercase tracking-wide mb-1">
                  Current plan
                </p>
                <p className="text-lg font-semibold text-[#451a03]">Professional</p>
                <p className="text-sm text-[#78350f]">$99/month</p>
              </div>
              <div>
                <p className="text-xs text-[#92400e] uppercase tracking-wide mb-1">
                  Next billing date
                </p>
                <p className="text-lg font-semibold text-[#451a03]">Feb 15, 2025</p>
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
        )}

        {/* No subscription notice for free users */}
        {currentTier !== 'paid' && (
          <Card variant="glass" padding="lg">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center flex-shrink-0">
                <Warning size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <h3 className="font-medium text-[#451a03] mb-1">
                  No active subscription
                </h3>
                <p className="text-sm text-[#78350f] mb-4">
                  Upgrade to Professional to access billing features and unlock premium features.
                </p>
                <Button
                  variant="primary"
                  onClick={() => router.push('/business/dashboard/settings/account/checkout')}
                >
                  Upgrade to Professional
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Payment Methods */}
        <PaymentMethods
          paymentMethods={currentTier === 'paid' ? paymentMethods : []}
          onAddMethod={handleAddPaymentMethod}
          onRemoveMethod={handleRemovePaymentMethod}
          onSetDefault={handleSetDefaultPaymentMethod}
        />

        {/* Billing History */}
        <BillingHistory
          invoices={currentTier === 'paid' ? invoices : []}
          onDownload={handleDownloadInvoice}
        />

        {/* Cancel Subscription (only for paid users) */}
        {currentTier === 'paid' && (
          <Card variant="glass" padding="lg">
            <h3 className="text-lg font-semibold text-[#451a03] mb-2">
              Cancel subscription
            </h3>
            <p className="text-sm text-[#78350f] mb-4">
              If you cancel, your Professional features will remain active until your current billing period ends.
              You can resubscribe at any time.
            </p>
            <Button
              variant="ghost"
              className="text-red-600 hover:text-red-600/80 hover:bg-red-400/10"
              onClick={() => setShowCancelModal(true)}
            >
              Cancel subscription
            </Button>
          </Card>
        )}
      </div>

      {/* Cancel Confirmation Modal */}
      <Modal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        title="Cancel subscription"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[#78350f]">
            Are you sure you want to cancel your Professional subscription?
          </p>
          <ul className="text-sm text-[#78350f] space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-[#92400e]">-</span>
              <span>You&apos;ll lose access to premium features at the end of your billing period</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#92400e]">-</span>
              <span>Your deals will remain active but won&apos;t have priority placement</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#92400e]">-</span>
              <span>You can resubscribe anytime to restore features</span>
            </li>
          </ul>
          <div className="flex gap-3 pt-2">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setShowCancelModal(false)}
            >
              Keep subscription
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleCancelSubscription}
              isLoading={isCancelling}
            >
              Cancel subscription
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
