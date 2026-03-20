'use client'

import { useState } from 'react'
import {
  CurrencyDollar,
  CheckCircle,
  Warning,
  Clock,
  FloppyDisk,
  Plus,
  User,
} from '@phosphor-icons/react'
import type { Business, BusinessTier } from '@/types/business'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getBillingOverridesForBusiness,
  createBillingOverride,
  type BillingStatus,
  type BillingOverride,
} from '@/lib/mock-data/platformSettings'

interface BusinessBillingOverrideProps {
  business: Business
}

function getTierBadge(tier: BusinessTier) {
  switch (tier) {
    case 'paid':
      return <Badge variant="brand">Paid</Badge>
    case 'free':
      return <Badge variant="info">Free</Badge>
    case 'unclaimed':
    default:
      return <Badge variant="default">Unclaimed</Badge>
  }
}

function getBillingStatusBadge(status: BillingStatus) {
  switch (status) {
    case 'active':
      return <Badge variant="success">Active</Badge>
    case 'suspended':
      return <Badge variant="error">Suspended</Badge>
    case 'comped':
      return <Badge variant="warning">Comped</Badge>
    default:
      return <Badge variant="default">{status}</Badge>
  }
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function BusinessBillingOverride({ business }: BusinessBillingOverrideProps) {
  const [overrideEnabled, setOverrideEnabled] = useState(false)
  const [selectedTier, setSelectedTier] = useState<BusinessTier>(business.tier)
  const [billingStatus, setBillingStatus] = useState<BillingStatus>('active')
  const [creditsToGrant, setCreditsToGrant] = useState<number>(0)
  const [customLeadPrice, setCustomLeadPrice] = useState<string>('')
  const [reason, setReason] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [overrides, setOverrides] = useState<BillingOverride[]>(() =>
    getBillingOverridesForBusiness(business.id)
  )

  const tierOptions: { value: BusinessTier; label: string }[] = [
    { value: 'unclaimed', label: 'Unclaimed' },
    { value: 'free', label: 'Free' },
    { value: 'paid', label: 'Paid' },
  ]

  const billingStatusOptions: { value: BillingStatus; label: string }[] = [
    { value: 'active', label: 'Active' },
    { value: 'suspended', label: 'Suspended' },
    { value: 'comped', label: 'Comped (Free)' },
  ]

  const handleSave = async () => {
    if (!reason.trim()) {
      return
    }

    setIsSaving(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Create override record
    const newOverride = createBillingOverride({
      businessId: business.id,
      previousTier: business.tier,
      newTier: selectedTier,
      previousBillingStatus: 'active',
      newBillingStatus: billingStatus,
      creditsGranted: creditsToGrant > 0 ? creditsToGrant : undefined,
      customLeadPrice: customLeadPrice ? parseFloat(customLeadPrice) : undefined,
      reason: reason.trim(),
      createdBy: 'admin-1', // Mock admin
    })

    setOverrides([newOverride, ...overrides])
    setIsSaving(false)
    setShowConfirmation(false)
    setOverrideEnabled(false)
    setCreditsToGrant(0)
    setCustomLeadPrice('')
    setReason('')
  }

  return (
    <div className="space-y-6">
      {/* Override Controls */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 flex items-center justify-center">
              <CurrencyDollar size={20} weight="fill" className="text-amber-400" />
            </div>
            <div>
              <CardTitle>Billing Override</CardTitle>
              <CardDescription>
                Manually override tier, billing status, and credits for this business
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {/* Current Status */}
        <div className="mb-6 p-4 rounded-xl bg-stone-900 border border-stone-800">
          <h4 className="text-sm font-medium text-stone-400 mb-3">Current Status</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-stone-500 mb-1">Tier</p>
              {getTierBadge(business.tier)}
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Business Status</p>
              <Badge variant={business.status === 'active' ? 'success' : 'warning'}>
                {business.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Claimed</p>
              <p className="text-sm text-stone-100">
                {business.claimedAt ? 'Yes' : 'No'}
              </p>
            </div>
            <div>
              <p className="text-xs text-stone-500 mb-1">Verified</p>
              <p className="text-sm text-stone-100">
                {business.isVerified ? 'Yes' : 'No'}
              </p>
            </div>
          </div>
        </div>

        {/* Override Toggle */}
        <div className="mb-6">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={overrideEnabled}
              onChange={(e) => setOverrideEnabled(e.target.checked)}
              className="w-5 h-5 rounded border-stone-800 bg-stone-900 text-amber-400 focus:ring-amber-400/50 cursor-pointer"
            />
            <span className="text-sm font-medium text-stone-100">
              Enable override mode
            </span>
          </label>
          <p className="text-xs text-stone-500 mt-1 ml-8">
            Toggle to make changes to this business&apos;s billing settings
          </p>
        </div>

        {overrideEnabled && (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Tier Assignment */}
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">
                Tier Assignment
              </label>
              <div className="grid grid-cols-3 gap-2">
                {tierOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setSelectedTier(option.value)}
                    className={`
                      p-3 rounded-xl border text-sm font-medium transition-all
                      ${
                        selectedTier === option.value
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Billing Status */}
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">
                Billing Status
              </label>
              <div className="grid grid-cols-3 gap-2">
                {billingStatusOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setBillingStatus(option.value)}
                    className={`
                      p-3 rounded-xl border text-sm font-medium transition-all
                      ${
                        billingStatus === option.value
                          ? 'border-amber-400 bg-amber-400/10 text-amber-400'
                          : 'border-stone-800 bg-stone-900 text-stone-400 hover:border-stone-700'
                      }
                    `}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Credit Grant */}
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">
                Grant Credits
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <Plus size={16} className="text-stone-400" />
                  <input
                    type="number"
                    value={creditsToGrant}
                    onChange={(e) => setCreditsToGrant(Number(e.target.value))}
                    className="w-24 px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 focus:border-amber-400 focus:outline-none"
                    min={0}
                    placeholder="0"
                  />
                  <span className="text-sm text-stone-400">credits</span>
                </div>
                <p className="text-xs text-stone-500">
                  Add bonus credits to this business account
                </p>
              </div>
            </div>

            {/* Custom Lead Pricing */}
            <div>
              <label className="block text-sm font-medium text-stone-400 mb-2">
                Custom Lead Price (Optional)
              </label>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-stone-400">$</span>
                  <input
                    type="number"
                    value={customLeadPrice}
                    onChange={(e) => setCustomLeadPrice(e.target.value)}
                    className="w-24 px-3 py-2 bg-stone-900 border border-stone-800 rounded-xl text-stone-100 focus:border-amber-400 focus:outline-none"
                    min={0}
                    step={0.5}
                    placeholder="—"
                  />
                  <span className="text-sm text-stone-400">/lead</span>
                </div>
                <p className="text-xs text-stone-500">
                  Leave empty to use tier default pricing
                </p>
              </div>
            </div>

            {/* Reason */}
            <div>
              <Input
                label="Reason for Override"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Partnership promotion, billing dispute resolution..."
                hint="Required - This will be logged in the audit trail"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-4 border-t border-stone-800">
              <Button
                variant="secondary"
                onClick={() => {
                  setOverrideEnabled(false)
                  setSelectedTier(business.tier)
                  setBillingStatus('active')
                  setCreditsToGrant(0)
                  setCustomLeadPrice('')
                  setReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={() => setShowConfirmation(true)}
                disabled={!reason.trim()}
              >
                <FloppyDisk size={16} />
                Save Override
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <Card variant="glass" padding="lg" className="max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-400/10 flex items-center justify-center">
                <Warning size={20} weight="fill" className="text-amber-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-stone-100">Confirm Override</h3>
                <p className="text-sm text-stone-400">
                  This action will be logged
                </p>
              </div>
            </div>

            <div className="space-y-2 mb-6 p-3 rounded-lg bg-stone-900">
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Tier</span>
                <span className="text-stone-100">{business.tier} → {selectedTier}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-stone-400">Billing Status</span>
                <span className="text-stone-100">{billingStatus}</span>
              </div>
              {creditsToGrant > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Credits Granted</span>
                  <span className="text-emerald-400">+{creditsToGrant}</span>
                </div>
              )}
              {customLeadPrice && (
                <div className="flex justify-between text-sm">
                  <span className="text-stone-400">Custom Lead Price</span>
                  <span className="text-stone-100">${customLeadPrice}/lead</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setShowConfirmation(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSave}
                isLoading={isSaving}
              >
                Confirm Override
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Audit Log */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Clock size={20} weight="fill" className="text-purple-400" />
            </div>
            <div>
              <CardTitle>Override History</CardTitle>
              <CardDescription>
                Audit log of all billing changes for this business
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        {overrides.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 mx-auto rounded-full bg-stone-900 flex items-center justify-center mb-3">
              <Clock size={24} className="text-stone-500" />
            </div>
            <p className="text-stone-400">No override history</p>
            <p className="text-sm text-stone-500">
              Changes made here will be logged for audit purposes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {overrides.map((override) => (
              <div
                key={override.id}
                className="p-4 rounded-xl bg-stone-900 border border-stone-800"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-amber-400/10 flex items-center justify-center">
                      <User size={12} className="text-amber-400" />
                    </div>
                    <span className="text-sm font-medium text-stone-100">
                      Admin Override
                    </span>
                  </div>
                  <span className="text-xs text-stone-500">
                    {formatDate(override.createdAt)}
                  </span>
                </div>

                <div className="space-y-1 ml-8">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-stone-400">Tier:</span>
                    <span className="text-stone-500">{override.previousTier}</span>
                    <span className="text-stone-500">→</span>
                    <span className="text-stone-100">{override.newTier}</span>
                  </div>

                  {override.newBillingStatus && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-stone-400">Status:</span>
                      {getBillingStatusBadge(override.newBillingStatus)}
                    </div>
                  )}

                  {override.creditsGranted && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-stone-400">Credits:</span>
                      <span className="text-emerald-400">+{override.creditsGranted}</span>
                    </div>
                  )}

                  {override.customLeadPrice && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-stone-400">Custom Lead Price:</span>
                      <span className="text-stone-100">${override.customLeadPrice}/lead</span>
                    </div>
                  )}

                  <p className="text-sm text-stone-500 mt-2 italic">
                    &quot;{override.reason}&quot;
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
