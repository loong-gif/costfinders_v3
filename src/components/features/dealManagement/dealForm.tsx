'use client'

import { ArrowLeft, FloppyDisk, Sparkle } from '@phosphor-icons/react'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { updateDealAction } from '@/lib/actions/deal-management'
import { formatPercentOff } from '@/lib/data/adapters'
import type { OfferView } from '@/types/supabase'

/**
 * The form is down to one line of text plus two prices, because that is the whole of what an
 * owner can persist. Category, unit, validity dates, minimum units and free-text terms were
 * columns on the denormalized `promo_offer_master`; they now live in `clinic_services` /
 * `clinic_promotions`, where `authenticated` holds SELECT only. Collecting them would have
 * been a form that validated fields it silently dropped — the terms textarea was even
 * *required*.
 *
 * Edit only. The create mode is gone with /business/dashboard/deals/new (an owner-created deal
 * could never go live), and so is the image uploader: it stored a file that no column linked
 * to the deal, so it never appeared to consumers or even when the owner reopened the deal.
 *
 * ponytail: giving these fields back needs a server-side path that writes the child rows as
 * service_role, not a widened grant. See DealInput in lib/actions/deal-management.ts.
 */
interface DealFormData {
  title: string
  originalPrice: string
  dealPrice: string
}

interface FormErrors {
  title?: string
  originalPrice?: string
  dealPrice?: string
}

interface DealFormProps {
  businessId: string
  deal: OfferView
}

export function DealForm({ businessId, deal }: DealFormProps) {
  const router = useRouter()
  const [formData, setFormData] = useState<DealFormData>({
    // offer_raw_text, not service_name: service_name is resolved from promo_offer_items for
    // scraped offers and is read-only, while offer_raw_text is the column this form writes.
    title: deal.offer_raw_text ?? '',
    originalPrice: deal.regular_price?.toString() ?? '',
    dealPrice: deal.discount_price?.toString() ?? '',
  })
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<
    'idle' | 'success' | 'error'
  >('idle')
  // The action's own message, so 'Your business claim is not yet approved.' is
  // distinguishable from a genuine database failure.
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
    if (errors[name as keyof FormErrors]) {
      setErrors((prev) => ({ ...prev, [name]: undefined }))
    }
  }

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {}

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required'
    }

    const originalPrice = Number.parseFloat(formData.originalPrice)
    if (
      !formData.originalPrice ||
      Number.isNaN(originalPrice) ||
      originalPrice <= 0
    ) {
      newErrors.originalPrice = 'Original price must be a positive number'
    }

    const dealPrice = Number.parseFloat(formData.dealPrice)
    if (!formData.dealPrice || Number.isNaN(dealPrice) || dealPrice <= 0) {
      newErrors.dealPrice = 'Deal price must be a positive number'
    } else if (!Number.isNaN(originalPrice) && dealPrice >= originalPrice) {
      newErrors.dealPrice = 'Deal price must be less than original price'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    setSubmitStatus('idle')

    try {
      const originalPrice = Number.parseFloat(formData.originalPrice)
      const dealPrice = Number.parseFloat(formData.dealPrice)

      // Every key here is a column that still exists on promo_offer_master.
      const result = await updateDealAction(deal.id, Number(businessId), {
        offer_raw_text: formData.title.trim(),
        regular_price: originalPrice,
        discount_price: dealPrice,
        discount_percent: Math.round(
          ((originalPrice - dealPrice) / originalPrice) * 100,
        ),
      })

      if (!result.success) {
        setSubmitError(result.error ?? null)
        setSubmitStatus('error')
        return
      }

      setSubmitStatus('success')
      setTimeout(() => {
        router.push('/business/dashboard/deals')
      }, 1000)
    } catch {
      setSubmitError(null)
      setSubmitStatus('error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const percentOff = Math.round(
    ((Number.parseFloat(formData.originalPrice) -
      Number.parseFloat(formData.dealPrice)) /
      Number.parseFloat(formData.originalPrice)) *
      100,
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          aria-label="Back to deals"
          onClick={() => router.push('/business/dashboard/deals')}
        >
          <ArrowLeft size={20} weight="light" aria-hidden="true" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary tracking-tight">
            Edit deal
          </h1>
          <p className="text-text-secondary mt-1">
            Change the text and prices on this deal
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card variant="glass" padding="lg">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4 tracking-tight">
            Deal
          </h2>
          <Input
            label="Deal"
            name="title"
            value={formData.title}
            onChange={handleChange}
            placeholder="e.g., Botox Special — $10 per unit for new clients"
            error={errors.title}
            hint="Your description of the deal. Deal cards show the treatment name instead when we have one."
          />
        </Card>

        <Card variant="glass" padding="lg">
          <h2 className="font-display text-lg font-semibold text-text-primary mb-4 tracking-tight">
            Pricing
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Original price"
              name="originalPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.originalPrice}
              onChange={handleChange}
              placeholder="e.g., 14"
              error={errors.originalPrice}
            />
            <Input
              label="Deal price"
              name="dealPrice"
              type="number"
              step="0.01"
              min="0"
              value={formData.dealPrice}
              onChange={handleChange}
              placeholder="e.g., 10"
              error={errors.dealPrice}
            />
          </div>

          {Number.isFinite(percentOff) && percentOff > 0 && (
            <div className="mt-4 p-3 bg-accent-muted rounded-xl">
              <p className="text-sm text-accent-hover">
                <Sparkle size={16} weight="fill" className="inline mr-1" />
                {formatPercentOff(percentOff)}
              </p>
            </div>
          )}
        </Card>

        {submitStatus === 'success' && (
          <output className="block p-4 bg-success-bg border border-success/20 rounded-xl">
            <p className="text-success">Deal saved. Taking you back…</p>
          </output>
        )}

        {submitStatus === 'error' && (
          <div
            role="alert"
            className="p-4 bg-error-bg border border-error/20 rounded-xl"
          >
            <p className="text-error">
              {submitError ?? 'Could not save this deal. Please try again.'}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/business/dashboard/deals')}
          >
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting}>
            <FloppyDisk size={20} weight="light" />
            Save changes
          </Button>
        </div>
      </form>
    </div>
  )
}
