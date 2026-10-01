/**
 * The helpers that turn a revealed clinic into things a customer can tap: directions, the
 * website, a phone number, and the date they asked for.
 *
 * Each one is printed in the reveal, the claim confirmation email, the ops lead email and the
 * admin relay screen, so a mistake is a wrong call or a wrong day in four places at once.
 *
 * The date test runs in Los Angeles on purpose: `new Date('2026-10-02')` is UTC midnight, which
 * prints as 1 October anywhere west of Greenwich. That is the bug formatDateOnly exists to stop,
 * and it cannot show up on a machine set to UTC. Each test file runs in its own process, so
 * setting TZ here does not leak into other files.
 */
process.env.TZ = 'America/Los_Angeles'

import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  addressLine,
  displayWebsite,
  mapsUrlForAddress,
  telHref,
  websiteHref,
} from '@/lib/utils/contactLinks'
import { formatDateOnly } from '@/lib/utils/dateOnly'
import { formatPhone } from '@/lib/utils/phone'

test('directions search the street address, with the city when given', () => {
  assert.equal(
    mapsUrlForAddress('6360 N Campbell Ave', 'Tucson'),
    'https://www.google.com/maps/search/?api=1&query=6360%20N%20Campbell%20Ave%2C%20Tucson',
  )
  assert.equal(
    mapsUrlForAddress('6360 N Campbell Ave, Tucson, AZ 85718'),
    'https://www.google.com/maps/search/?api=1&query=6360%20N%20Campbell%20Ave%2C%20Tucson%2C%20AZ%2085718',
  )
  assert.equal(mapsUrlForAddress(null, null), null)
  assert.equal(mapsUrlForAddress('', ''), null)
})

test('the address prints the city once', () => {
  assert.equal(
    addressLine('6360 N Campbell Ave, Tucson, AZ 85718', 'Tucson'),
    '6360 N Campbell Ave, Tucson, AZ 85718',
  )
  assert.equal(
    addressLine('14591 Newport Ave', 'Tustin'),
    '14591 Newport Ave, Tustin',
  )
  assert.equal(addressLine(null, 'Tustin'), 'Tustin')
  assert.equal(addressLine(null, null), null)
})

test('the website link drops tracking codes and gains https', () => {
  assert.equal(
    websiteHref('https://dreammedspa.com/?utm_source=gmb&utm_medium=organic'),
    'https://dreammedspa.com/',
  )
  assert.equal(
    websiteHref('www.dermfx.com/botox?utm_source=gmb#top'),
    'https://www.dermfx.com/botox',
  )
  // An http site stays http; forcing https on a site without a certificate breaks the link.
  assert.equal(websiteHref('http://example.com/?a=1'), 'http://example.com/')
  assert.equal(websiteHref(null), null)
  assert.equal(websiteHref('not a url'), null)
})

test('a website value that is not a web address never becomes a link', () => {
  for (const value of ['javascript:alert(1)', 'data:text/html,<b>x</b>']) {
    assert.equal(websiteHref(value), null, value)
    assert.equal(displayWebsite(value), null, value)
  }
})

test('the printed website is the bare host', () => {
  assert.equal(
    displayWebsite('https://www.dermfx.com/?utm_source=gmb'),
    'dermfx.com',
  )
  assert.equal(displayWebsite('dermfx.com'), 'dermfx.com')
  assert.equal(displayWebsite(undefined), null)
})

test('the phone link dials the stored number; the text reads as a US number', () => {
  assert.equal(telHref('+15205550123'), 'tel:+15205550123')
  assert.equal(telHref('(520) 555-0123'), 'tel:5205550123')
  assert.equal(telHref('call us'), null)
  assert.equal(telHref(null), null)
  assert.equal(formatPhone('+19495550123'), '(949) 555-0123')
  // Not E.164: shown as stored rather than hidden (see phone.ts).
  assert.equal(formatPhone('949-555-0123'), '949-555-0123')
})

test('a calendar date prints the day the customer picked, west of Greenwich', () => {
  // Proves the zone is in effect: the naive parse lands on 1 October here.
  assert.equal(
    new Date('2026-10-02').toLocaleDateString('en-US', { day: 'numeric' }),
    '1',
  )
  assert.equal(formatDateOnly('2026-10-02'), 'Oct 2, 2026')
  assert.equal(
    formatDateOnly('2026-10-02', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }),
    'Friday, October 2',
  )
  // A timestamp column that slipped through still prints its calendar day.
  assert.equal(formatDateOnly('2026-10-02T00:00:00+00:00'), 'Oct 2, 2026')
  assert.equal(formatDateOnly(null), '')
  assert.equal(formatDateOnly('next week'), 'next week')
})
