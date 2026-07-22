import assert from 'node:assert/strict'
import test from 'node:test'
import { safeDashboardPath } from './auth-redirect'

test('accepts only local consumer dashboard paths', () => {
  assert.equal(safeDashboardPath('/dashboard'), '/dashboard')
  assert.equal(safeDashboardPath('/dashboard/settings'), '/dashboard/settings')
  assert.equal(safeDashboardPath('//evil.example'), null)
  assert.equal(safeDashboardPath('https://evil.example'), null)
  assert.equal(safeDashboardPath('/admin/dashboard'), null)
  assert.equal(safeDashboardPath('/business/dashboard'), null)
})
