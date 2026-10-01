import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { treatmentCost, treatmentDo } from './treatment-grammar'

// The five labels the guide set actually ships. A regression here reads as
// "How much does dermal fillers cost" on a live page.
test('plural treatment labels take plural verbs', () => {
  for (const label of ['Dermal Fillers', 'Facials', 'Laser Treatments']) {
    assert.equal(treatmentDo(label), 'do', label)
    assert.equal(treatmentCost(label), 'cost', label)
  }
})

test('singular treatment labels take singular verbs', () => {
  for (const label of ['Botox', 'Microneedling']) {
    assert.equal(treatmentDo(label), 'does', label)
    assert.equal(treatmentCost(label), 'costs', label)
  }
})

test('casing and stray whitespace do not change agreement', () => {
  assert.equal(treatmentDo('  dermal fillers  '), 'do')
  assert.equal(treatmentCost('BOTOX'), 'costs')
})
