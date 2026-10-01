/**
 * guideContentDefects() is what stands between the weekly generator and a published guide
 * whose Competition card reads "x" — which is what the first generated Newport Beach guide did.
 * The schema the model fills guarantees shape, not content.
 */
import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import {
  getAvailableGuides,
  guideContentDefects,
  loadGuideContent,
} from '@/lib/data/guide-content'
import type { GuideContent } from '@/types/guide'

const long = (n: number) => 'word '.repeat(n).trim()

function guide(overrides: Partial<GuideContent> = {}): GuideContent {
  return {
    treatment: 'botox',
    treatmentLabel: 'Botox',
    city: 'newport-beach',
    cityLabel: 'Newport Beach',
    state: 'California',
    stateCode: 'CA',
    generatedAt: '2026-09-25',
    howPricingWorks: {
      intro: long(40),
      pricingModels: [
        {
          name: 'Charged Per Unit',
          description: long(20),
          typicalRange: long(3),
        },
        {
          name: 'Charged Flat Per Area',
          description: long(20),
          typicalRange: long(3),
        },
        {
          name: 'No Figure Published',
          description: long(20),
          typicalRange: long(3),
        },
      ],
    },
    whatAffectsPricing: {
      intro: long(20),
      factors: Array.from({ length: 4 }, () => ({
        factor: long(3),
        explanation: long(20),
      })),
    },
    howToSave: {
      intro: long(20),
      tips: Array.from({ length: 4 }, () => ({
        tip: long(3),
        detail: long(20),
      })),
    },
    nationalComparison: {
      nationalAvgPerUnit: 13,
      localAvgPerUnit: 10,
      comparisonText: long(20),
    },
    faqs: Array.from({ length: 6 }, () => ({
      question: 'How much does Botox cost in Newport Beach?',
      answer: long(30),
    })),
    cityContext: {
      medspaDensity: long(20),
      demographicNotes: long(20),
      competitionNotes: long(20),
    },
    ...overrides,
  }
}

test('a complete guide has no defects', () => {
  assert.deepEqual(guideContentDefects(guide()), [])
})

test('an empty or placeholder field is a defect, named by path', () => {
  const defects = guideContentDefects(
    guide({
      cityContext: {
        medspaDensity: long(20),
        demographicNotes: long(20),
        competitionNotes: 'x',
      },
    }),
  )
  assert.deepEqual(defects, [
    'cityContext.competitionNotes: under 60 characters',
  ])
})

test('FAQ questions must say "cost", never "pricing", and end with "?"', () => {
  const g = guide()
  g.faqs[0] = {
    question: 'What is Botox pricing in Newport Beach?',
    answer: long(30),
  }
  g.faqs[1] = {
    question: 'How much does Botox cost in Newport Beach',
    answer: long(30),
  }
  // "prices" is the true word where a clinic quotes one; the style guide keeps it.
  g.faqs[2] = {
    question: 'Why do two clinics quote such different prices?',
    answer: long(30),
  }
  const defects = guideContentDefects(g)
  assert.equal(defects.length, 2, defects.join('\n'))
  assert.ok(
    defects.some((d) => d.startsWith('faqs[0].question says "pricing"')),
  )
  assert.ok(defects.some((d) => d.startsWith('faqs[1].question does not end')))
})

test('a missing section counts as zero entries', () => {
  const defects = guideContentDefects(guide({ faqs: [] }))
  assert.deepEqual(defects, ['faqs: 0 entries, expected 4–12'])
})

test('every published guide file passes', () => {
  for (const entry of getAvailableGuides()) {
    const content = loadGuideContent(entry.slug)
    assert.ok(content, `${entry.slug} does not load`)
    assert.deepEqual(guideContentDefects(content), [], entry.slug)
  }
})
