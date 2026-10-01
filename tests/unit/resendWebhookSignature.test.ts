/**
 * The Resend webhook routes trust nothing that fails verifyResendSignature, so it must reject
 * every forgery and still accept Resend's real signatures. The vector below is the published
 * Svix example, and it was checked against `standardwebhooks` (the library the Resend SDK
 * delegates to) on 2026-09-23, so it is an independent reference rather than this code
 * grading itself.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  forwardedEmail,
  isOwnAddress,
  recipientHash,
  verifyResendSignature,
} from '@/lib/email/inbound'

const SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw'
const ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
const TS = '1614265330'
const BODY = '{"test": 2432232314}'
const SIG = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='
const AT = Number(TS) * 1000

function headers(overrides: Record<string, string> = {}): Headers {
  return new Headers({
    'svix-id': ID,
    'svix-timestamp': TS,
    'svix-signature': SIG,
    ...overrides,
  })
}

test('accepts the reference signature', () => {
  assert.equal(verifyResendSignature(SECRET, headers(), BODY, AT), true)
})

test('accepts a secret with a trailing newline, as a pasted env value has', () => {
  assert.equal(verifyResendSignature(`${SECRET}\n`, headers(), BODY, AT), true)
})

test('accepts when one of several rotated signatures matches', () => {
  const rotated = headers({ 'svix-signature': `v1,AAAA ${SIG}` })
  assert.equal(verifyResendSignature(SECRET, rotated, BODY, AT), true)
})

test('rejects a tampered body, a wrong secret and a wrong id', () => {
  assert.equal(verifyResendSignature(SECRET, headers(), `${BODY} `, AT), false)
  assert.equal(
    verifyResendSignature(
      'whsec_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      headers(),
      BODY,
      AT,
    ),
    false,
  )
  assert.equal(
    verifyResendSignature(SECRET, headers({ 'svix-id': 'msg_x' }), BODY, AT),
    false,
  )
})

test('rejects a replay outside the 5-minute window, either side', () => {
  assert.equal(
    verifyResendSignature(SECRET, headers(), BODY, AT + 301_000),
    false,
  )
  assert.equal(
    verifyResendSignature(SECRET, headers(), BODY, AT - 301_000),
    false,
  )
  assert.equal(
    verifyResendSignature(SECRET, headers(), BODY, AT + 299_000),
    true,
  )
})

test('rejects missing headers, a non-v1 scheme and a malformed timestamp', () => {
  assert.equal(verifyResendSignature(SECRET, new Headers(), BODY, AT), false)
  assert.equal(
    verifyResendSignature(
      SECRET,
      headers({ 'svix-signature': SIG.replace('v1,', 'v2,') }),
      BODY,
      AT,
    ),
    false,
  )
  assert.equal(
    verifyResendSignature(
      SECRET,
      headers({ 'svix-timestamp': '1614265330.5' }),
      BODY,
      AT,
    ),
    false,
  )
})

test('own-domain filter handles display names and case, and rejects look-alikes', () => {
  assert.equal(isOwnAddress('CostFinders <Notifications@CostFinders.ai>'), true)
  assert.equal(isOwnAddress('leads@costfinders.ai'), true)
  assert.equal(isOwnAddress('someone@notcostfinders.ai'), false)
  assert.equal(isOwnAddress('leads@costfinders.ai.evil.com'), false)
  assert.equal(isOwnAddress(''), false)
})

test('recipient hash is stable, short and not the address', () => {
  const hash = recipientHash('Someone <A@Example.com>')
  assert.equal(hash, recipientHash('a@example.com'))
  assert.match(hash, /^[0-9a-f]{12}$/)
})

test('forwarded copy escapes the stranger-supplied fields and flattens the subject', () => {
  const { subject, html } = forwardedEmail(
    {
      from: 'x <x@example.com>',
      to: ['support@costfinders.ai'],
      subject: 'hi\r\nBcc: victim@example.com',
      text: '<script>alert(1)</script>',
      headers: null,
    },
    'id-1',
    ['support@costfinders.ai'],
  )
  assert.equal(subject.includes('\n'), false)
  assert.equal(html.includes('<script>'), false)
  assert.equal(html.includes('&lt;x@example.com&gt;'), true)
})

test('the forward replies to the sender, and only to a well-formed address', () => {
  const forward = (from: string) =>
    forwardedEmail(
      { from, to: [], subject: null, text: null, headers: null },
      'id-1',
      ['support@costfinders.ai'],
    )
  const good = forward('Jane Doe <Jane@Example.com>')
  assert.equal(good.replyTo, 'jane@example.com')
  assert.equal(good.html.includes('Reply to this message'), true)
  for (const bad of ['', 'jane', 'a@b.c, evil@x.com', '<a@b@c.com>']) {
    const f = forward(bad)
    assert.equal(f.replyTo, undefined, bad)
    assert.equal(f.html.includes('does not reach the sender'), true, bad)
  }
})
