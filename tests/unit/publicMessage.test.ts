import assert from 'node:assert/strict'
import { test } from 'node:test'
import { publicErrorMessage } from '@/lib/errors/publicMessage'

const rls = {
  code: '42501',
  message: 'new row violates row-level security policy for table "claims"',
}

test('never returns the database text', () => {
  for (const error of [
    rls,
    { code: '42703', message: 'column claims.original_price does not exist' },
    { code: 'PGRST204', message: "Could not find the 'x' column of 'claims'" },
    new Error('relation "public.claims" does not exist'),
    'raw string',
    null,
  ]) {
    const text = publicErrorMessage(error, 'Fallback.')
    assert.equal(text.includes('claims'), false, text)
    assert.equal(text.includes('column'), false, text)
  }
})

test('maps the codes a user can hit', () => {
  assert.equal(publicErrorMessage(rls), "You don't have permission to do that.")
  assert.match(publicErrorMessage({ code: '23505' }), /already/)
  assert.match(publicErrorMessage({ code: '23503' }), /no longer exists/)
  assert.match(publicErrorMessage({ code: 'PGRST301' }), /sign in again/)
  assert.equal(
    publicErrorMessage({ code: 'PGRST116' }),
    "We couldn't find that.",
  )
  assert.match(publicErrorMessage({ code: 'PT429' }), /Too many requests/)
  assert.equal(publicErrorMessage({ code: 'XX000' }, 'Fallback.'), 'Fallback.')
})
