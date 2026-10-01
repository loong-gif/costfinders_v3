import assert from 'node:assert/strict'
import { test } from 'node:test'
import { logger } from '@/lib/logger'

test('the logger never writes an email address', () => {
  const lines: string[] = []
  const original = console.log
  console.log = (line: string) => lines.push(line)
  try {
    logger.info('Mailed ada@example.com', {
      action: 'test',
      body: '{"message":"Invalid `to` field: ops+leads@costfinders.ai"}',
      count: 3,
    })
  } finally {
    console.log = original
  }
  assert.equal(lines.length, 1)
  assert.equal(lines[0].includes('@'), false, lines[0])
  assert.equal(JSON.parse(lines[0]).count, 3)
})
