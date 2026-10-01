/**
 * Which credential /auth/callback tries, for each shape Supabase can hand back.
 *
 * The ordering here is the whole reason the route was rewritten. A magic link requested on a
 * laptop and opened on a phone carries no usable PKCE `code` — the verifier cookie sits on the
 * laptop — so `token_hash` has to be tried FIRST wherever both are present, and an empty result
 * has to mean "hand off to the client for the fragment", not "fail". Both were live failures:
 * a real link landed on `/?auth_error=true#access_token=…`, session unread.
 *
 * No network: callbackAttempts() only decides what to call, never calls it. That decision is
 * exactly the part a live test cannot cover cheaply, since reproducing it needs a real emailed
 * link per shape.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { callbackAttempts, parseOtpType } from '@/lib/auth/callbackParams'

const attemptsFor = (query: string) =>
  callbackAttempts(new URLSearchParams(query))

test('a token_hash link is verified, not exchanged', () => {
  assert.deepEqual(attemptsFor('token_hash=abc123&type=magiclink'), [
    { kind: 'token_hash', token_hash: 'abc123', type: 'magiclink' },
  ])
})

test('a PKCE link is exchanged', () => {
  assert.deepEqual(attemptsFor('code=pkce-code'), [
    { kind: 'code', code: 'pkce-code' },
  ])
})

test('token_hash is tried before code when both are present', () => {
  const attempts = attemptsFor('code=pkce-code&token_hash=abc123&type=recovery')
  assert.deepEqual(
    attempts.map((a) => a.kind),
    ['token_hash', 'code'],
    'PKCE first would strand every cross-device open',
  )
})

test('an implicit-flow link yields nothing to try server-side', () => {
  // The tokens are in the fragment, which never reaches the server: the query string is bare.
  assert.deepEqual(attemptsFor(''), [])
  assert.deepEqual(attemptsFor('next=/dashboard'), [])
})

test('a token_hash with no usable type is not attempted', () => {
  // Left alone rather than guessed at: verifyOtp would reject it, and guessing "magiclink"
  // would silently apply the wrong verification to a recovery or email-change link.
  assert.deepEqual(attemptsFor('token_hash=abc123'), [])
  assert.deepEqual(attemptsFor('token_hash=abc123&type=sms'), [])
  assert.deepEqual(attemptsFor('token_hash=abc123&type=magiclink%20'), [])
})

test('every email OTP type Supabase can send survives validation', () => {
  for (const type of [
    'magiclink',
    'signup',
    'invite',
    'recovery',
    'email_change',
    'email',
  ]) {
    assert.equal(parseOtpType(type), type, `${type} links must still work`)
  }
})

test('anything else is rejected rather than cast', () => {
  for (const value of ['sms', 'phone_change', 'admin', '', null]) {
    assert.equal(parseOtpType(value), null, `${value} must not reach verifyOtp`)
  }
})
