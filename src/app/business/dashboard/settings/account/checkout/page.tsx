'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CaretLeft, CheckCircle, Crown, Check, Lock, ShieldCheck } from '@phosphor-icons/react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { MockPaymentForm } from '@/components/features/mockPaymentForm'

const PLAN_PRICE = 99
const PLAN_NAME = 'Professional'

const INCLUDED_FEATURES = [
  'Unlimited deal listings',
  'Priority placement in search results',
  'Advanced analytics dashboard',
  'Customer messaging',
  'Promotional badges',
  'Custom business profile',
  'Priority customer support',
]

function generateMockSubscriptionId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = 'sub_'
  for (let i = 0; i < 14; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default function CheckoutPage() {
  const router = useRouter()
  const [isProcessing, setIsProcessing] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [subscriptionId, setSubscriptionId] = useState('')

  const handleCheckout = () => {
    setIsProcessing(true)
    // Simulate payment processing
    setTimeout(() => {
      setIsProcessing(false)
      setIsSuccess(true)
      setSubscriptionId(generateMockSubscriptionId())
    }, 2000)
  }

  const handleContinue = () => {
    router.push('/business/dashboard/settings/account?upgraded=true')
  }

  // Success State
  if (isSuccess) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Card variant="glass" padding="lg" className="max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-600/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={40} weight="fill" className="text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-[#451a03] mb-2">
            Welcome to Professional!
          </h1>
          <p className="text-[#78350f] mb-6">
            Your subscription is now active. You have access to all premium features.
          </p>
          <div className="bg-[#f2ebe2] rounded-xl p-4 mb-6">
            <p className="text-xs text-[#92400e] mb-1">Subscription ID</p>
            <p className="text-sm font-mono text-[#451a03]">{subscriptionId}</p>
          </div>
          <div className="space-y-3">
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              onClick={handleContinue}
            >
              Continue to Dashboard
            </Button>
            <p className="text-xs text-[#92400e]">
              A confirmation email has been sent to your account
            </p>
          </div>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {/* Back Link */}
      <Link
        href="/business/dashboard/settings/account"
        className="inline-flex items-center gap-2 text-[#78350f] hover:text-[#451a03] transition-colors"
      >
        <CaretLeft size={18} weight="light" />
        <span>Back to Account</span>
      </Link>

      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#451a03]">Upgrade to Professional</h1>
        <p className="text-[#78350f] mt-1">
          Complete your subscription to unlock all premium features
        </p>
      </div>

      {/* Secure Checkout Banner */}
      <div className="flex items-center gap-2 text-sm text-emerald-600 bg-emerald-600/10 rounded-xl px-4 py-2.5 border border-emerald-400/20">
        <ShieldCheck size={18} weight="fill" />
        <span>256-bit SSL encryption. Your payment information is secure.</span>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Order Summary */}
        <Card variant="glass" padding="lg" className="h-fit">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-800/8 flex items-center justify-center">
              <Crown size={24} weight="fill" className="text-amber-800" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-[#451a03]">
                {PLAN_NAME} Plan
              </h2>
              <p className="text-sm text-[#78350f]">Monthly subscription</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-baseline gap-1 mb-6">
            <span className="text-4xl font-bold text-[#451a03]">${PLAN_PRICE}</span>
            <span className="text-[#78350f]">/month</span>
          </div>

          {/* Included Features */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-[#78350f] uppercase tracking-wide">
              What&apos;s included
            </h3>
            <ul className="space-y-2.5">
              {INCLUDED_FEATURES.map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-emerald-600/10 flex items-center justify-center flex-shrink-0">
                    <Check size={12} weight="bold" className="text-emerald-600" />
                  </div>
                  <span className="text-sm text-[#451a03]">{feature}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Order Total */}
          <div className="mt-6 pt-6 border-t border-[#d4c4b0]">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[#78350f]">Subtotal</span>
              <span className="text-[#451a03]">${PLAN_PRICE}.00</span>
            </div>
            <div className="flex justify-between items-center mb-4">
              <span className="text-[#78350f]">Tax</span>
              <span className="text-[#451a03]">$0.00</span>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-[#d4c4b0]">
              <span className="font-semibold text-[#451a03]">Total due today</span>
              <span className="text-xl font-bold text-[#451a03]">${PLAN_PRICE}.00</span>
            </div>
          </div>

          {/* Billing Info */}
          <div className="mt-6 p-3 bg-[#f2ebe2] rounded-xl">
            <p className="text-xs text-[#92400e]">
              You will be charged ${PLAN_PRICE}.00 monthly. Cancel anytime from your account settings.
              Your subscription will renew automatically unless cancelled before the billing date.
            </p>
          </div>
        </Card>

        {/* Right: Payment Form */}
        <Card variant="glass" padding="lg">
          <h2 className="text-lg font-semibold text-[#451a03] mb-6">
            Payment details
          </h2>
          <MockPaymentForm
            amount={PLAN_PRICE}
            planName={PLAN_NAME}
            onSubmit={handleCheckout}
            isLoading={isProcessing}
          />
        </Card>
      </div>

      {/* Trust Badges */}
      <div className="flex flex-wrap items-center justify-center gap-6 text-[#92400e] text-xs">
        <div className="flex items-center gap-2">
          <Lock size={14} weight="fill" />
          <span>Secure payments</span>
        </div>
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} weight="fill" />
          <span>Money-back guarantee</span>
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={14} weight="fill" />
          <span>Cancel anytime</span>
        </div>
      </div>
    </div>
  )
}
