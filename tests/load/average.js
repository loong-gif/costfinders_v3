import http from 'k6/http'
import { check, sleep } from 'k6'
import { Trend } from 'k6/metrics'

const homepageTTFB = new Trend('homepage_ttfb')
const dealsTTFB = new Trend('deals_ttfb')
const treatmentsTTFB = new Trend('treatments_ttfb')

export const options = {
  stages: [
    { duration: '1m', target: 25 },
    { duration: '3m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
    homepage_ttfb: ['p(95)<500'],
    deals_ttfb: ['p(95)<800'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://www.costfinders.ai'

const cities = ['oklahoma-city', 'irvine', 'tucson', 'santa-ana', 'tustin']
const treatments = ['neurotoxins', 'fillers', 'facials-lasers', 'wellness']

function weightedRandom() {
  const r = Math.random()
  if (r < 0.30) return 'homepage'
  if (r < 0.55) return 'city-deals'
  if (r < 0.70) return 'treatments'
  if (r < 0.80) return 'guides'
  return 'health'
}

export default function () {
  const scenario = weightedRandom()
  let res

  switch (scenario) {
    case 'homepage':
      res = http.get(`${BASE_URL}/`)
      check(res, { 'homepage 200': (r) => r.status === 200 })
      homepageTTFB.add(res.timings.waiting)
      break

    case 'city-deals': {
      const city = cities[Math.floor(Math.random() * cities.length)]
      res = http.get(`${BASE_URL}/deals/${city}`)
      check(res, { 'deals 200': (r) => r.status === 200 })
      dealsTTFB.add(res.timings.waiting)
      break
    }

    case 'treatments': {
      const treatment = treatments[Math.floor(Math.random() * treatments.length)]
      res = http.get(`${BASE_URL}/treatments/${treatment}`)
      check(res, { 'treatment 200': (r) => r.status === 200 })
      treatmentsTTFB.add(res.timings.waiting)
      break
    }

    case 'guides':
      res = http.get(`${BASE_URL}/guides/botox-pricing-oklahoma-city`)
      check(res, { 'guide 200': (r) => r.status === 200 })
      break

    case 'health':
      res = http.get(`${BASE_URL}/api/health`)
      check(res, { 'health 200': (r) => r.status === 200 })
      break
  }

  sleep(Math.random() * 3 + 1)
}
