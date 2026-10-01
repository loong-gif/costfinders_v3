/**
 * The phone number the contact reveal will print to a customer who paid for it with their own
 * contact details.
 *
 * A wrong number here is worse than no number: the customer calls a stranger, or a marketing
 * vendor's tracking line that attributes the call to someone else's campaign. Med-spas are heavy
 * users of call tracking (CallRail et al.), and every one of those vendors works by shipping the
 * clinic's real number in the HTML and swapping it in the DOM with JavaScript. So the rules under
 * test are: trust machine-readable claims over free text, and never accept free text alone on a
 * page that also ships a tracking vendor.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  choosePhoneFromHtml,
  detectTrackingVendors,
  extractPhonesFromHtml,
  normaliseWebsite,
  toE164,
} from '../../scripts/backfill-business-phone'

test('toE164 accepts the shapes a real page writes', () => {
  for (const input of [
    '(949) 482-0123',
    '949-482-0123',
    '949.482.0123',
    '9494820123',
    '+1 949 482 0123',
    '1-949-482-0123',
    'Call us: (949) 482‑0123 today', // note: en-dash, stripped as a non-digit
  ]) {
    assert.equal(toE164(input), '+19494820123', `failed on ${input}`)
  }
})

test('toE164 rejects what a 10-digit regex would wrongly collect', () => {
  const rejected: [string, string][] = [
    ['0123456789', 'area code starts with 0'],
    ['1123456789', 'area code starts with 1'],
    ['9491550123', 'exchange starts with 1'],
    ['9490550123', 'exchange starts with 0'],
    ['4114820123', 'x11 service code as area code'],
    ['9114820123', 'x11 service code as area code'],
    ['949555012', 'nine digits'],
    ['94948201234', 'eleven digits not starting with 1'],
    ['29494820123', 'eleven digits, wrong country prefix'],
    ['', 'empty'],
    ['$1,299 for 20 units', 'a price'],
    ['9495550100', '555-01xx is reserved for fiction'],
  ]
  for (const [input, why] of rejected) {
    assert.equal(toE164(input), null, `should have rejected ${input} (${why})`)
  }
})

test('JSON-LD telephone outranks a tel: href and page text', () => {
  const html = `
    <html><head>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"MedicalClinic",
         "name":"Radiance","telephone":"(949) 482-0123"}
      </script>
    </head><body>
      <a href="tel:+19494829999">Call now</a>
      <p>Or reach our other office at 949-482-8888</p>
    </body></html>`

  const candidates = extractPhonesFromHtml(html)
  assert.equal(candidates[0].e164, '+19494820123')
  assert.match(candidates[0].how, /json-ld/)
  // All three are still surfaced — the caller wants to see what else was on the page.
  assert.equal(candidates.length, 3)
})

test('JSON-LD is reached inside an @graph, and survives unparseable JSON', () => {
  const graph = `<script type="application/ld+json">
    {"@graph":[{"@type":"WebSite"},{"@type":"LocalBusiness","telephone":"949-482-0123"}]}
  </script>`
  assert.equal(extractPhonesFromHtml(graph)[0].e164, '+19494820123')

  // Trailing comma: invalid JSON. Real sites ship this constantly, so the regex fallback matters.
  const broken = `<script type="application/ld+json">
    {"@type":"LocalBusiness","telephone":"949-482-0123",}
  </script>`
  const fromBroken = extractPhonesFromHtml(broken)
  assert.equal(fromBroken[0].e164, '+19494820123')
  assert.match(fromBroken[0].how, /unparsed/)
})

test('numbers inside <script> and <style> never become page-text candidates', () => {
  // This is the tracking vendor's swap table. It must not be mistaken for the clinic's number.
  const html = `<html><body>
    <script>var swapMap = {"9494820123":"9494829999"};</script>
    <style>/* ticket 9494828888 */</style>
    <p>No phone on this page.</p>
  </body></html>`
  assert.deepEqual(extractPhonesFromHtml(html), [])
})

test('detectTrackingVendors finds a vendor by its script host', () => {
  const html = `<script src="//cdn.callrail.com/companies/123/swap.js"></script>`
  assert.deepEqual(detectTrackingVendors(html), ['callrail'])
  assert.deepEqual(detectTrackingVendors('<p>no vendors here</p>'), [])
})

test('free text alone on a tracking-vendor page is refused', () => {
  const html = `<html><head>
      <script src="https://cdn.callrail.com/companies/1/swap.js"></script>
    </head><body><p>Call 949-482-0123</p></body></html>`

  // The number IS extracted — the caller needs to report what it saw ...
  assert.equal(extractPhonesFromHtml(html)[0].e164, '+19494820123')
  // ... but it is not good enough to store.
  assert.equal(choosePhoneFromHtml(html), null)
})

test('a machine-readable claim IS trusted even when a tracking vendor is present', () => {
  const html = `<html><head>
      <script src="https://cdn.callrail.com/companies/1/swap.js"></script>
      <script type="application/ld+json">{"@type":"MedicalClinic","telephone":"949-482-0123"}</script>
    </head><body><p>Call 949-482-9999</p></body></html>`

  const chosen = choosePhoneFromHtml(html)
  assert.equal(chosen?.e164, '+19494820123')
  assert.deepEqual(chosen?.trackingVendors, ['callrail'])
})

test('a page with no number at all yields null rather than a guess', () => {
  assert.equal(
    choosePhoneFromHtml('<html><body><h1>Book online</h1></body></html>'),
    null,
  )
})

test('normaliseWebsite copes with the shapes actually in master_business_info.website', () => {
  assert.equal(normaliseWebsite('example.com'), 'https://example.com/')
  assert.equal(
    normaliseWebsite('  https://example.com/path  '),
    'https://example.com/path',
  )
  assert.equal(normaliseWebsite('http://example.com'), 'http://example.com/')
  assert.equal(normaliseWebsite(null), null)
  assert.equal(normaliseWebsite(''), null)
  assert.equal(normaliseWebsite('   '), null)
  // No dot in the host: not a website, and left alone rather than fetched.
  assert.equal(normaliseWebsite('localhost'), null)
  assert.equal(normaliseWebsite('not a url at all'), null)
})
