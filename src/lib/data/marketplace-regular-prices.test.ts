import assert from 'node:assert/strict'
import test from 'node:test'
import {
  type ClinicServiceWithBusiness,
  summarizeRegularPrices,
} from './marketplace'

function service(
  overrides: Partial<ClinicServiceWithBusiness> &
    Pick<ClinicServiceWithBusiness, 'business_id' | 'regular_price'>,
): ClinicServiceWithBusiness {
  return {
    service_id: 1,
    service_category: 'Neurotoxin',
    unit_type: 'unit',
    service_name: 'Botox',
    master_business_info: { business_id: 1, name: 'Clinic A', city: 'Austin' },
    ...overrides,
  }
}

test('summarizeRegularPrices groups by city, category, and unit', () => {
  const rows = [
    service({ service_id: 1, business_id: 1, regular_price: 12 }),
    service({ service_id: 2, business_id: 2, regular_price: 14 }),
    service({
      service_id: 3,
      business_id: 3,
      regular_price: 10,
      master_business_info: {
        business_id: 3,
        name: 'Clinic C',
        city: 'Dallas',
      },
    }),
    service({
      service_id: 4,
      business_id: 1,
      regular_price: 8,
      unit_type: 'area',
    }),
  ]

  const comparisons = summarizeRegularPrices(rows)

  assert.equal(comparisons.length, 2)
  assert.equal(comparisons[0]?.city, 'Austin')
  assert.equal(comparisons[0]?.serviceCategory, 'Neurotoxin')

  const austinUnits = comparisons[0]?.units ?? []
  assert.equal(austinUnits.length, 2)

  const perUnit = austinUnits.find((unit) => unit.unitType === 'unit')
  assert.ok(perUnit)
  assert.equal(perUnit.providerCount, 2)
  assert.equal(perUnit.minimum, 12)
  assert.equal(perUnit.maximum, 14)
  assert.equal(perUnit.median, null)

  const perArea = austinUnits.find((unit) => unit.unitType === 'area')
  assert.ok(perArea)
  assert.equal(perArea.providerCount, 1)
  assert.equal(perArea.minimum, 8)
})

test('summarizeRegularPrices keeps the lowest price per provider', () => {
  const rows = [
    service({ service_id: 1, business_id: 1, regular_price: 15 }),
    service({ service_id: 2, business_id: 1, regular_price: 11 }),
    service({ service_id: 3, business_id: 2, regular_price: 13 }),
    service({ service_id: 4, business_id: 2, regular_price: 12 }),
    service({ service_id: 5, business_id: 3, regular_price: 10 }),
  ]

  const [comparison] = summarizeRegularPrices(rows)
  const [unit] = comparison?.units ?? []

  assert.equal(unit?.providerCount, 3)
  assert.deepEqual(unit?.prices, [10, 11, 12])
  assert.equal(unit?.minimum, 10)
  assert.equal(unit?.maximum, 12)
  assert.equal(unit?.median, 11)
})
