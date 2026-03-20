'use client'

import { CreditCard, Plus, Star, Trash } from '@phosphor-icons/react'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import type { PaymentMethod } from '@/lib/mock-data/billing'

interface PaymentMethodsProps {
  paymentMethods: PaymentMethod[]
  onAddMethod?: () => void
  onRemoveMethod?: (id: string) => void
  onSetDefault?: (id: string) => void
}

function CardBrandIcon({ brand }: { brand: PaymentMethod['brand'] }) {
  if (brand === 'visa') {
    return (
      <div className="w-10 h-6 bg-blue-600 rounded flex items-center justify-center">
        <span className="text-[10px] font-bold text-white italic">VISA</span>
      </div>
    )
  }
  if (brand === 'mastercard') {
    return (
      <div className="w-10 h-6 flex items-center justify-center">
        <div className="w-4 h-4 rounded-full bg-red-500 -mr-1.5" />
        <div className="w-4 h-4 rounded-full bg-amber-500" />
      </div>
    )
  }
  if (brand === 'amex') {
    return (
      <div className="w-10 h-6 bg-blue-500 rounded flex items-center justify-center">
        <span className="text-[8px] font-bold text-white">AMEX</span>
      </div>
    )
  }
  return <CreditCard size={24} weight="light" className="text-[#92400e]" />
}

function formatExpiry(month: number, year: number): string {
  return `${month.toString().padStart(2, '0')}/${year.toString().slice(-2)}`
}

function getBrandName(brand: PaymentMethod['brand']): string {
  switch (brand) {
    case 'visa':
      return 'Visa'
    case 'mastercard':
      return 'Mastercard'
    case 'amex':
      return 'American Express'
  }
}

export function PaymentMethods({
  paymentMethods,
  onAddMethod,
  onRemoveMethod,
  onSetDefault,
}: PaymentMethodsProps) {
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const handleConfirmDelete = () => {
    if (deleteConfirmId) {
      onRemoveMethod?.(deleteConfirmId)
      setDeleteConfirmId(null)
    }
  }

  if (paymentMethods.length === 0) {
    return (
      <Card variant="glass" padding="lg">
        <div className="text-center py-8">
          <div className="w-12 h-12 rounded-xl bg-[#f2ebe2] flex items-center justify-center mx-auto mb-3">
            <CreditCard size={24} weight="light" className="text-[#92400e]" />
          </div>
          <h3 className="font-medium text-[#451a03] mb-1">
            No payment methods
          </h3>
          <p className="text-sm text-[#78350f] mb-4">
            Add a payment method to manage your subscription.
          </p>
          <Button variant="primary" onClick={onAddMethod}>
            <Plus size={18} weight="bold" />
            Add Payment Method
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <>
      <Card variant="glass" padding="lg">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[#451a03]">
            Payment Methods
          </h3>
          <Button variant="secondary" size="sm" onClick={onAddMethod}>
            <Plus size={16} weight="bold" />
            Add New
          </Button>
        </div>

        <div className="space-y-3">
          {paymentMethods.map((method) => (
            <div
              key={method.id}
              className={`
                p-4 rounded-xl border transition-colors
                ${
                  method.isDefault
                    ? 'bg-amber-800/5 border-amber-800/15'
                    : 'bg-[#f2ebe2] border-[#d4c4b0] hover:border-[#c4b09a]'
                }
              `}
            >
              <div className="flex items-center gap-4">
                {/* Card Brand Icon */}
                <CardBrandIcon brand={method.brand} />

                {/* Card Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[#451a03]">
                      {getBrandName(method.brand)} ending in {method.last4}
                    </span>
                    {method.isDefault && (
                      <Badge variant="brand" size="sm">
                        Default
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-[#92400e] mt-0.5">
                    Expires {formatExpiry(method.expMonth, method.expYear)}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  {!method.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSetDefault?.(method.id)}
                      className="text-[#78350f] hover:text-[#451a03]"
                      title="Set as default"
                    >
                      <Star size={16} weight="light" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteConfirmId(method.id)}
                    className="text-[#78350f] hover:text-red-600"
                    title="Remove"
                    disabled={method.isDefault && paymentMethods.length === 1}
                  >
                    <Trash size={16} weight="light" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Info text */}
        <p className="text-xs text-[#92400e] mt-4">
          Your default payment method will be charged for subscription renewals.
        </p>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={!!deleteConfirmId}
        onClose={() => setDeleteConfirmId(null)}
        title="Remove Payment Method"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-[#78350f]">
            Are you sure you want to remove this payment method? This action
            cannot be undone.
          </p>
          <div className="flex gap-3">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              className="flex-1"
              onClick={handleConfirmDelete}
            >
              Remove
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
