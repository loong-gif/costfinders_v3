import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 5,
  duration: '30s',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

const BASE_URL = __ENV.BASE_URL || 'https://www.costfinders.ai'

const pages = [
  { name: 'homepage', url: '/' },
  { name: 'deals', url: '/deals/oklahoma-city' },
  { name: 'treatments', url: '/treatments' },
  { name: 'health', url: '/api/health' },
]

export default function () {
  const page = pages[Math.floor(Math.random() * pages.length)]
  const res = http.get(`${BASE_URL}${page.url}`)
  check(res, {
    [`${page.name} status 200`]: (r) => r.status === 200,
    [`${page.name} duration < 2s`]: (r) => r.timings.duration < 2000,
  })
  sleep(1)
}
