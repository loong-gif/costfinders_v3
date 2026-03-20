'use client'

import { Check, CreditCard, Lock, Users } from '@phosphor-icons/react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import type {
  BusinessCredits,
  CreditPackage,
} from '@/lib/mock-data/leadPricing'
import { purchaseCredits } from '@/lib/mock-data/leadPricing'

type PurchaseState = 'confirm' | 'processing' | 'success'

interface LeadPurchaseModalProps {
  isOpen: boolean
  onClose: () => void
  selectedPackage: CreditPackage | null
  currentBalance: BusinessCredits
  onPurchaseComplete?: (newCredits: BusinessCredits) => void
}

export function LeadPurchaseModal({
  isOpen,
  onClose,
  selectedPackage,
  currentBalance,
  onPurchaseComplete,
}: LeadPurchaseModalProps) {
  const [state, setState] = useState<PurchaseState>('confirm')
  const [newBalance, setNewBalance] = useState<BusinessCredits | null>(null)

  if (!selectedPackage) return null

  const handlePurchase = async () => {
    setState('processing')

    // Simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Mock purchase
    const updatedCredits = purchaseCredits(selectedPackage.id)
    if (updatedCredits) {
      setNewBalance(updatedCredits)
      setState('success')
    }
  }

  const handleClose = () => {
    if (state === 'success' && newBalance && onPurchaseComplete) {
      onPurchaseComplete(newBalance)
    }
    setState('confirm')
    setNewBalance(null)
    onClose()
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Buy leads"
      size="md"
      mobileVariant="fullscreen"
    >
      {state === 'confirm' && (
        <div className="space-y-6">
          {/* Package Summary */}
          <div className="bg-[#f2ebe2] rounded-xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <Users size={24} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#451a03]">
                  {selectedPackage.credits} leads
                </h3>
                <p className="text-sm text-[#78350f]">
                  ${selectedPackage.pricePerLead.toFixed(2)} per lead
                </p>
              </div>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-[#78350f]">Package price</span>
                <span className="text-[#451a03]">
                  ${selectedPackage.price.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#78350f]">Leads included</span>
                <span className="text-[#451a03]">
                  {selectedPackage.credits} leads
                </span>
              </div>
              {selectedPackage.savingsPercent > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Savings</span>
                  <span>{selectedPackage.savingsPercent}% off</span>
                </div>
              )}
            </div>
          </div>

          {/* Current Balance Info */}
          <div className="bg-[#f2ebe2] rounded-xl p-4">
            <p className="text-sm text-[#78350f] mb-2">After purchase:</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#78350f]">Current balance</span>
              <span className="text-[#451a03]">
                {currentBalance.available} leads
              </span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-sm text-[#78350f]">New balance</span>
              <span className="text-lg font-semibold text-amber-800">
                {currentBalance.available + selectedPackage.credits} leads
              </span>
            </div>
          </div>

          {/* Payment Method (Mock) */}
          <div className="bg-[#f2ebe2] rounded-xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                <span className="text-xs font-bold text-white italic">
                  VISA
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[#451a03]">
                  Visa ending in 4242
                </p>
                <p className="text-xs text-[#78350f]">Expires 12/27</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <Button
              variant="secondary"
              onClick={handleClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handlePurchase}
              className="flex-1"
            >
              Pay ${selectedPackage.price.toFixed(2)}
            </Button>
          </div>

          {/* Secure Payment Notice */}
          <div className="flex items-center justify-center gap-2 text-xs text-[#92400e]">
            <Lock size={14} weight="fill" className="text-emerald-600" />
            <span>Secure checkout powered by Stripe</span>
          </div>
        </div>
      )}

      {state === 'processing' && (
        <div className="py-12 text-center">
          <div className="w-16 h-16 rounded-full bg-amber-800/8 flex items-center justify-center mx-auto mb-4">
            <CreditCard
              size={32}
              weight="fill"
              className="text-amber-800 animate-pulse"
            />
          </div>
          <h3 className="text-lg font-semibold text-[#451a03] mb-2">
            Processing payment
          </h3>
          <p className="text-sm text-[#78350f]">
            Please wait while we process your purchase...
          </p>
        </div>
      )}

      {state === 'success' && newBalance && (
        <div className="py-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-600/10 flex items-center justify-center mx-auto mb-4">
            <Check size={32} weight="bold" className="text-emerald-600" />
          </div>
          <h3 className="text-lg font-semibold text-[#451a03] mb-2">
            Purchase complete!
          </h3>
          <p className="text-sm text-[#78350f] mb-6">
            {selectedPackage.credits} leads have been added to your account.
          </p>

          {/* New Balance */}
          <div className="bg-[#f2ebe2] rounded-xl p-4 mb-6 inline-block">
            <p className="text-sm text-[#78350f] mb-1">New balance</p>
            <p className="text-3xl font-bold text-amber-800">
              {newBalance.available} leads
            </p>
          </div>

          <Button variant="primary" onClick={handleClose} className="w-full">
            Done
          </Button>
        </div>
      )}
    </Modal>
  )
}
