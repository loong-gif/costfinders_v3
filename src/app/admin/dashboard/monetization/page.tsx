'use client'

import { useState } from 'react'
import {
  CurrencyDollar,
  ChartLine,
  CreditCard,
  Tag,
  CheckCircle,
  X,
  FloppyDisk,
  Rocket,
} from '@phosphor-icons/react'
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  getPlatformSettings,
  updateTierPricing,
  updateLeadPricing,
  updateSponsorshipPricing,
  updatePlatformFees,
  calculateEffectivePrice,
} from '@/lib/mock-data/platformSettings'

export default function MonetizationSettingsPage() {
  const initialSettings = getPlatformSettings()

  // Tier pricing state
  const [paidTierPrice, setPaidTierPrice] = useState(initialSettings.tierPricing.paid)

  // Lead pricing state
  const [freeLeadPrice, setFreeLeadPrice] = useState(initialSettings.leadPricingByTier.free)
  const [paidLeadPrice, setPaidLeadPrice] = useState(initialSettings.leadPricingByTier.paid)

  // Sponsorship pricing state
  const [sevenDayPrice, setSevenDayPrice] = useState(initialSettings.sponsorshipPricing.sevenDay)
  const [fourteenDayPrice, setFourteenDayPrice] = useState(
    initialSettings.sponsorshipPricing.fourteenDay
  )
  const [thirtyDayPrice, setThirtyDayPrice] = useState(initialSettings.sponsorshipPricing.thirtyDay)

  // Platform fees state
  const [transactionFee, setTransactionFee] = useState(
    initialSettings.platformFees.transactionFee * 100
  )
  const [platformFee, setPlatformFee] = useState(initialSettings.platformFees.platformFee * 100)

  // Save states
  const [savingSection, setSavingSection] = useState<string | null>(null)
  const [savedSection, setSavedSection] = useState<string | null>(null)

  const handleSave = async (section: string) => {
    setSavingSection(section)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    switch (section) {
      case 'tiers':
        updateTierPricing({ paid: paidTierPrice })
        break
      case 'leads':
        updateLeadPricing({ free: freeLeadPrice, paid: paidLeadPrice })
        break
      case 'sponsorship':
        updateSponsorshipPricing({
          sevenDay: sevenDayPrice,
          fourteenDay: fourteenDayPrice,
          thirtyDay: thirtyDayPrice,
        })
        break
      case 'fees':
        updatePlatformFees({
          transactionFee: transactionFee / 100,
          platformFee: platformFee / 100,
        })
        break
    }

    setSavingSection(null)
    setSavedSection(section)
    setTimeout(() => setSavedSection(null), 2000)
  }

  // Calculate example for fees
  const examplePrice = 100
  const feeCalculation = calculateEffectivePrice(examplePrice)

  return (
    <div className="space-y-8">
      {/* Section 1: Subscription Tiers */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <CreditCard size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <CardTitle>Subscription Tiers</CardTitle>
                <CardDescription>Monthly subscription pricing for business accounts</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedSection === 'tiers' && (
                <Badge variant="success" size="sm">
                  <CheckCircle size={14} weight="fill" className="mr-1" />
                  Saved
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => handleSave('tiers')}
                isLoading={savingSection === 'tiers'}
              >
                <FloppyDisk size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Free Tier */}
          <div className="p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-[#451a03]">Free Tier</h4>
                <p className="text-sm text-[#78350f]">Basic business listing</p>
              </div>
              <Badge variant="default">Default</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-3xl font-bold text-[#451a03]">$0</span>
              <span className="text-[#78350f]">/month</span>
            </div>
            <div className="space-y-2">
              {initialSettings.tierFeatures
                .filter((f) => f.freeIncluded)
                .map((feature) => (
                  <div key={feature.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} weight="fill" className="text-emerald-600" />
                    <span className="text-[#78350f]">{feature.name}</span>
                  </div>
                ))}
              {initialSettings.tierFeatures
                .filter((f) => !f.freeIncluded)
                .slice(0, 3)
                .map((feature) => (
                  <div key={feature.id} className="flex items-center gap-2 text-sm">
                    <X size={16} weight="bold" className="text-[#92400e]" />
                    <span className="text-[#92400e]">{feature.name}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Paid Tier */}
          <div className="p-4 rounded-xl bg-amber-800/5 border border-amber-800/15">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h4 className="font-semibold text-[#451a03]">Paid Tier</h4>
                <p className="text-sm text-[#78350f]">Premium business features</p>
              </div>
              <Badge variant="brand">Recommended</Badge>
            </div>
            <div className="flex items-end gap-3 mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-[#78350f]">$</span>
                <input
                  type="number"
                  value={paidTierPrice}
                  onChange={(e) => setPaidTierPrice(Number(e.target.value))}
                  className="w-20 text-3xl font-bold text-[#451a03] bg-transparent border-b-2 border-amber-800/25 focus:border-amber-800 focus:outline-none"
                  min={0}
                />
              </div>
              <span className="text-[#78350f] pb-1">/month</span>
            </div>
            <div className="space-y-2">
              {initialSettings.tierFeatures
                .filter((f) => f.paidIncluded)
                .map((feature) => (
                  <div key={feature.id} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={16} weight="fill" className="text-amber-800" />
                    <span className="text-[#78350f]">{feature.name}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Section 2: Lead Pricing */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-600/10 flex items-center justify-center">
                <CurrencyDollar size={20} weight="fill" className="text-emerald-600" />
              </div>
              <div>
                <CardTitle>Lead Pricing</CardTitle>
                <CardDescription>Per-lead costs by tier and credit package pricing</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedSection === 'leads' && (
                <Badge variant="success" size="sm">
                  <CheckCircle size={14} weight="fill" className="mr-1" />
                  Saved
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => handleSave('leads')}
                isLoading={savingSection === 'leads'}
              >
                <FloppyDisk size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Per-Lead Pricing */}
        <div className="mb-8">
          <h4 className="text-sm font-medium text-[#78350f] mb-4">Per-Lead Cost by Tier</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
              <div>
                <p className="text-sm text-[#78350f]">Free Tier</p>
                <p className="text-xs text-[#92400e]">Standard pricing</p>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <span className="text-[#78350f]">$</span>
                <input
                  type="number"
                  value={freeLeadPrice}
                  onChange={(e) => setFreeLeadPrice(Number(e.target.value))}
                  className="w-16 text-lg font-semibold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none"
                  min={0}
                  step={0.5}
                />
                <span className="text-[#78350f]">/lead</span>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 rounded-xl bg-amber-800/5 border border-amber-800/15">
              <div>
                <p className="text-sm text-[#78350f]">Paid Tier</p>
                <p className="text-xs text-[#92400e]">Discounted pricing</p>
              </div>
              <div className="flex-1" />
              <div className="flex items-center gap-1">
                <span className="text-[#78350f]">$</span>
                <input
                  type="number"
                  value={paidLeadPrice}
                  onChange={(e) => setPaidLeadPrice(Number(e.target.value))}
                  className="w-16 text-lg font-semibold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none"
                  min={0}
                  step={0.5}
                />
                <span className="text-[#78350f]">/lead</span>
              </div>
            </div>
          </div>
        </div>

        {/* Credit Packages Table */}
        <div>
          <h4 className="text-sm font-medium text-[#78350f] mb-4">Credit Packages</h4>

          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#d4c4b0]">
                  <th className="text-left text-sm font-medium text-[#78350f] px-4 py-3">
                    Package
                  </th>
                  <th className="text-left text-sm font-medium text-[#78350f] px-4 py-3">
                    Credits
                  </th>
                  <th className="text-left text-sm font-medium text-[#78350f] px-4 py-3">
                    Price
                  </th>
                  <th className="text-left text-sm font-medium text-[#78350f] px-4 py-3">
                    Per Lead
                  </th>
                  <th className="text-left text-sm font-medium text-[#78350f] px-4 py-3">
                    Savings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#d4c4b0]">
                {initialSettings.creditPackages.map((pkg) => (
                  <tr key={pkg.id} className="hover:bg-[#faf5ee] transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[#451a03]">{pkg.credits} Credits</span>
                        {pkg.isBestValue && (
                          <Badge variant="brand" size="sm">
                            Best Value
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#78350f]">{pkg.credits}</td>
                    <td className="px-4 py-3 text-[#451a03] font-medium">
                      ${pkg.price.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-[#78350f]">
                      ${pkg.pricePerLead.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="success" size="sm">
                        {pkg.savingsPercent}% off
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden space-y-3">
            {initialSettings.creditPackages.map((pkg) => (
              <div
                key={pkg.id}
                className="p-4 bg-[#f2ebe2] rounded-xl border border-[#d4c4b0]"
              >
                {/* Header: Package Name + Best Value Badge */}
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-medium text-[#451a03]">{pkg.credits} Credits</p>
                    <p className="text-sm text-[#92400e] mt-0.5">{pkg.credits} leads</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {pkg.isBestValue && (
                      <Badge variant="brand" size="sm">
                        Best Value
                      </Badge>
                    )}
                    <Badge variant="success" size="sm">
                      {pkg.savingsPercent}% off
                    </Badge>
                  </div>
                </div>

                {/* Footer: Price + Per Lead */}
                <div className="flex items-center justify-between pt-3 border-t border-[#d4c4b0]">
                  <div>
                    <p className="text-xs text-[#92400e]">Total</p>
                    <p className="text-lg font-semibold text-[#451a03]">
                      ${pkg.price.toFixed(2)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-[#92400e]">Per Lead</p>
                    <p className="text-sm font-medium text-[#78350f]">
                      ${pkg.pricePerLead.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Section 3: Sponsored Placements */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <Rocket size={20} weight="fill" className="text-purple-400" />
              </div>
              <div>
                <CardTitle>Sponsored Placements</CardTitle>
                <CardDescription>Boost pricing and impression multipliers for deals</CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedSection === 'sponsorship' && (
                <Badge variant="success" size="sm">
                  <CheckCircle size={14} weight="fill" className="mr-1" />
                  Saved
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => handleSave('sponsorship')}
                isLoading={savingSection === 'sponsorship'}
              >
                <FloppyDisk size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 7 Day Boost */}
          <div className="p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-[#451a03]">7-Day Boost</h4>
              <Badge variant="default" size="sm">
                2x impressions
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#78350f]">$</span>
              <input
                type="number"
                value={sevenDayPrice}
                onChange={(e) => setSevenDayPrice(Number(e.target.value))}
                className="w-20 text-2xl font-bold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none"
                min={0}
              />
            </div>
            <p className="text-xs text-[#92400e]">Featured in category listings</p>
          </div>

          {/* 14 Day Boost */}
          <div className="p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-[#451a03]">14-Day Boost</h4>
              <Badge variant="info" size="sm">
                3x impressions
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#78350f]">$</span>
              <input
                type="number"
                value={fourteenDayPrice}
                onChange={(e) => setFourteenDayPrice(Number(e.target.value))}
                className="w-20 text-2xl font-bold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none"
                min={0}
              />
            </div>
            <p className="text-xs text-[#92400e]">Featured + homepage carousel</p>
          </div>

          {/* 30 Day Boost */}
          <div className="p-4 rounded-xl bg-amber-800/5 border border-amber-800/15">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-[#451a03]">30-Day Boost</h4>
              <Badge variant="brand" size="sm">
                5x impressions
              </Badge>
            </div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[#78350f]">$</span>
              <input
                type="number"
                value={thirtyDayPrice}
                onChange={(e) => setThirtyDayPrice(Number(e.target.value))}
                className="w-20 text-2xl font-bold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none"
                min={0}
              />
            </div>
            <p className="text-xs text-[#92400e]">All placements + email spotlight</p>
          </div>
        </div>
      </Card>

      {/* Section 4: Platform Fees */}
      <Card variant="glass" padding="lg">
        <CardHeader className="mb-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-800/8 flex items-center justify-center">
                <ChartLine size={20} weight="fill" className="text-amber-800" />
              </div>
              <div>
                <CardTitle>Platform Fees</CardTitle>
                <CardDescription>
                  Transaction and platform fee percentages applied to payments
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {savedSection === 'fees' && (
                <Badge variant="success" size="sm">
                  <CheckCircle size={14} weight="fill" className="mr-1" />
                  Saved
                </Badge>
              )}
              <Button
                size="sm"
                onClick={() => handleSave('fees')}
                isLoading={savingSection === 'fees'}
              >
                <FloppyDisk size={16} />
                Save Changes
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Fee Inputs */}
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
              <div className="flex-1">
                <p className="text-sm font-medium text-[#451a03]">Transaction Fee</p>
                <p className="text-xs text-[#92400e]">Payment processor fee (e.g., Stripe)</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={transactionFee}
                  onChange={(e) => setTransactionFee(Number(e.target.value))}
                  className="w-16 text-lg font-semibold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none text-right"
                  min={0}
                  max={100}
                  step={0.1}
                />
                <span className="text-[#78350f]">%</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
              <div className="flex-1">
                <p className="text-sm font-medium text-[#451a03]">Platform Fee</p>
                <p className="text-xs text-[#92400e]">CostFinders marketplace fee</p>
              </div>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  value={platformFee}
                  onChange={(e) => setPlatformFee(Number(e.target.value))}
                  className="w-16 text-lg font-semibold text-[#451a03] bg-[#f2ebe2] border border-[#d4c4b0] rounded-lg px-2 py-1 focus:border-amber-800 focus:outline-none text-right"
                  min={0}
                  max={100}
                  step={0.1}
                />
                <span className="text-[#78350f]">%</span>
              </div>
            </div>
          </div>

          {/* Example Calculation */}
          <div className="p-4 rounded-xl bg-[#f2ebe2] border border-[#d4c4b0]">
            <h4 className="text-sm font-medium text-[#78350f] mb-4">Example Calculation</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[#78350f]">Sale Amount</span>
                <span className="text-[#451a03] font-semibold">
                  ${examplePrice.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#78350f]">
                  Transaction Fee ({transactionFee.toFixed(1)}%)
                </span>
                <span className="text-red-600">
                  -${(examplePrice * (transactionFee / 100)).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#78350f]">Platform Fee ({platformFee.toFixed(1)}%)</span>
                <span className="text-red-600">
                  -${(examplePrice * (platformFee / 100)).toFixed(2)}
                </span>
              </div>
              <div className="pt-3 border-t border-[#d4c4b0]">
                <div className="flex justify-between items-center">
                  <span className="text-[#451a03] font-medium">Net Revenue</span>
                  <span className="text-emerald-600 font-bold text-lg">
                    $
                    {(
                      examplePrice -
                      examplePrice * (transactionFee / 100) -
                      examplePrice * (platformFee / 100)
                    ).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}
