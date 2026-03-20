export interface Invoice {
  id: string
  date: string
  amount: number
  status: 'paid' | 'pending' | 'failed'
  description: string
  invoiceUrl?: string
}

export interface PaymentMethod {
  id: string
  brand: 'visa' | 'mastercard' | 'amex'
  last4: string
  expMonth: number
  expYear: number
  isDefault: boolean
}

// Mock invoices data
const invoices: Invoice[] = [
  {
    id: 'inv_001',
    date: '2025-01-15',
    amount: 99,
    status: 'paid',
    description: 'Professional Plan - January 2025',
    invoiceUrl: '#',
  },
  {
    id: 'inv_002',
    date: '2024-12-15',
    amount: 99,
    status: 'paid',
    description: 'Professional Plan - December 2024',
    invoiceUrl: '#',
  },
  {
    id: 'inv_003',
    date: '2024-11-15',
    amount: 99,
    status: 'paid',
    description: 'Professional Plan - November 2024',
    invoiceUrl: '#',
  },
  {
    id: 'inv_004',
    date: '2024-10-15',
    amount: 99,
    status: 'paid',
    description: 'Professional Plan - October 2024',
    invoiceUrl: '#',
  },
  {
    id: 'inv_005',
    date: '2024-09-15',
    amount: 99,
    status: 'failed',
    description: 'Professional Plan - September 2024',
    invoiceUrl: '#',
  },
]

// Mock payment methods data
const paymentMethods: PaymentMethod[] = [
  {
    id: 'pm_001',
    brand: 'visa',
    last4: '4242',
    expMonth: 12,
    expYear: 2027,
    isDefault: true,
  },
  {
    id: 'pm_002',
    brand: 'mastercard',
    last4: '8888',
    expMonth: 6,
    expYear: 2026,
    isDefault: false,
  },
]

/**
 * Get all invoices for the business
 */
export function getInvoices(): Invoice[] {
  return [...invoices]
}

/**
 * Get all payment methods for the business
 */
export function getPaymentMethods(): PaymentMethod[] {
  return [...paymentMethods]
}

/**
 * Get the default payment method
 */
export function getDefaultPaymentMethod(): PaymentMethod | undefined {
  return paymentMethods.find((pm) => pm.isDefault)
}

/**
 * Add a new payment method (mock)
 */
export function addPaymentMethod(
  brand: PaymentMethod['brand'],
  last4: string,
  expMonth: number,
  expYear: number,
): PaymentMethod {
  const newMethod: PaymentMethod = {
    id: `pm_${Date.now()}`,
    brand,
    last4,
    expMonth,
    expYear,
    isDefault: paymentMethods.length === 0,
  }
  paymentMethods.push(newMethod)
  return newMethod
}

/**
 * Remove a payment method (mock)
 */
export function removePaymentMethod(id: string): boolean {
  const index = paymentMethods.findIndex((pm) => pm.id === id)
  if (index === -1) return false
  if (paymentMethods[index].isDefault && paymentMethods.length > 1) {
    // If removing default, make another one default
    const nextDefault = paymentMethods.find((pm) => pm.id !== id)
    if (nextDefault) nextDefault.isDefault = true
  }
  paymentMethods.splice(index, 1)
  return true
}

/**
 * Set a payment method as default (mock)
 */
export function setDefaultPaymentMethod(id: string): boolean {
  const method = paymentMethods.find((pm) => pm.id === id)
  if (!method) return false
  paymentMethods.forEach((pm) => {
    pm.isDefault = pm.id === id
  })
  return true
}
