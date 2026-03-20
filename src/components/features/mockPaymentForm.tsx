'use client'

import { useState } from 'react'
import { CreditCard, Lock, Check } from '@phosphor-icons/react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

interface MockPaymentFormProps {
  amount: number
  planName: string
  onSubmit: () => void
  isLoading?: boolean
}

const US_STATES = [
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
]

function formatCardNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 16)
  const parts = digits.match(/.{1,4}/g) || []
  return parts.join(' ')
}

function formatExpiry(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 2) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }
  return digits
}

function getCardBrand(cardNumber: string): 'visa' | 'mastercard' | 'amex' | 'unknown' {
  const firstDigit = cardNumber.replace(/\s/g, '')[0]
  if (firstDigit === '4') return 'visa'
  if (firstDigit === '5') return 'mastercard'
  if (firstDigit === '3') return 'amex'
  return 'unknown'
}

function CardBrandIcon({ brand }: { brand: 'visa' | 'mastercard' | 'amex' | 'unknown' }) {
  if (brand === 'visa') {
    return (
      <div className="w-8 h-5 bg-blue-600 rounded flex items-center justify-center">
        <span className="text-[8px] font-bold text-white italic">VISA</span>
      </div>
    )
  }
  if (brand === 'mastercard') {
    return (
      <div className="w-8 h-5 flex items-center justify-center">
        <div className="w-3 h-3 rounded-full bg-red-500 -mr-1" />
        <div className="w-3 h-3 rounded-full bg-amber-500" />
      </div>
    )
  }
  if (brand === 'amex') {
    return (
      <div className="w-8 h-5 bg-blue-500 rounded flex items-center justify-center">
        <span className="text-[6px] font-bold text-white">AMEX</span>
      </div>
    )
  }
  return <CreditCard size={20} weight="light" className="text-[#92400e]" />
}

export function MockPaymentForm({ amount, planName, onSubmit, isLoading = false }: MockPaymentFormProps) {
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [name, setName] = useState('')
  const [country, setCountry] = useState('US')
  const [state, setState] = useState('')
  const [zip, setZip] = useState('')

  const cardBrand = getCardBrand(cardNumber)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Card Number */}
      <div className="relative">
        <Input
          label="Card number"
          value={cardNumber}
          onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
          placeholder="4242 4242 4242 4242"
          required
          autoComplete="cc-number"
          className="pr-12"
        />
        <div className="absolute right-3 top-[34px]">
          <CardBrandIcon brand={cardBrand} />
        </div>
      </div>

      {/* Expiry and CVC Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Expiration"
          value={expiry}
          onChange={(e) => setExpiry(formatExpiry(e.target.value))}
          placeholder="MM/YY"
          required
          autoComplete="cc-exp"
        />
        <Input
          label="CVC"
          value={cvc}
          onChange={(e) => setCvc(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="123"
          required
          autoComplete="cc-csc"
        />
      </div>

      {/* Cardholder Name */}
      <Input
        label="Cardholder name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name on card"
        required
        autoComplete="cc-name"
      />

      {/* Country */}
      <div>
        <label className="block text-sm font-medium text-[#78350f] mb-1.5">
          Country or region
        </label>
        <select
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          className="w-full px-4 py-2.5 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800/40 hover:border-[#d4c4b0]-hover"
        >
          <option value="US">United States</option>
          <option value="CA">Canada</option>
          <option value="GB">United Kingdom</option>
          <option value="AU">Australia</option>
        </select>
      </div>

      {/* State and ZIP (for US) */}
      {country === 'US' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[#78350f] mb-1.5">
              State
            </label>
            <select
              value={state}
              onChange={(e) => setState(e.target.value)}
              className="w-full px-4 py-2.5 bg-[#f2ebe2] border border-[#d4c4b0] rounded-xl text-[#451a03] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-800/40 focus:border-amber-800/40 hover:border-[#d4c4b0]-hover"
              required
            >
              <option value="">Select state</option>
              {US_STATES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="ZIP code"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="12345"
            required
          />
        </div>
      )}

      {/* Submit Button */}
      <div className="pt-2">
        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          isLoading={isLoading}
          disabled={isLoading}
        >
          Subscribe - ${amount}/month
        </Button>
      </div>

      {/* Secure Checkout Indicator */}
      <div className="flex items-center justify-center gap-2 text-xs text-[#92400e]">
        <Lock size={14} weight="fill" className="text-green-400" />
        <span>Secure checkout powered by Stripe</span>
      </div>
    </form>
  )
}
