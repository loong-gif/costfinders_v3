/**
 * The two category maps, held exhaustive against the live vocabulary.
 *
 * A silent fallthrough here has now caused two outages. `service_category` moved off
 * `promo_offer_master` onto `clinic_services` when the schema normalized and the vocabulary
 * changed wholesale; only 5 of the 25 keys the maps used to hold still existed, the 9 unmapped
 * new values covered 780 of 849 categorized offers, and every one of them fell through a
 * default — so `Neurotoxin`, 493 offers and the single biggest bucket on the site, rendered
 * under "Body" and merged into "Other Services" with no error anywhere.
 *
 * Both maps default rather than throw, which is right for rendering and fatal for detection.
 * These assertions are the detection. The live vocabulary comes from
 * `supabase/schema-snapshot.json`, which `scripts/check-schema-drift.ts` captures from and
 * re-verifies against the database — so this file stays pure while still being anchored to real
 * data, and a new DB category fails the drift gate first and then these tests.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import {
  dbCategoryToTreatment,
  offerTreatmentRoute,
  TREATMENT_TO_DB,
  treatmentToDbCategories,
} from '@/lib/data/adapters'
import { CATEGORY_MAP, getCategoryBucket } from '@/lib/data/categories'
import { treatmentDo } from '@/lib/utils/treatment-grammar'
import type { TreatmentCategory } from '@/types/deal'
import type { ClinicServiceCategory } from '@/types/supabase'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

function liveVocabulary(): ClinicServiceCategory[] {
  const snapshot = JSON.parse(
    readFileSync(join(REPO, 'supabase', 'schema-snapshot.json'), 'utf8'),
  ) as { vocabulary?: Record<string, ClinicServiceCategory[]> }
  const values = snapshot.vocabulary?.['clinic_services.service_category']
  assert.ok(
    values && values.length > 0,
    'supabase/schema-snapshot.json carries no clinic_services.service_category vocabulary — run `npm run schema:snapshot`',
  )
  return values
}

test('every live service_category resolves a treatment route', () => {
  for (const category of liveVocabulary()) {
    assert.notEqual(
      offerTreatmentRoute(category),
      null,
      `${category} is in the database and maps to no treatment page, so its offers get no badge and appear on no treatment page`,
    )
  }
})

test('every live service_category is an explicit key of CATEGORY_MAP', () => {
  for (const category of liveVocabulary()) {
    assert.ok(
      category in CATEGORY_MAP,
      `${category} is in the database and absent from CATEGORY_MAP, so its offers are on no /treatments page`,
    )
  }
})

test('Neurotoxin resolves to botox and to the neurotoxins bucket, not to a fallback', () => {
  // The specific regression that has now happened twice.
  assert.equal(dbCategoryToTreatment('Neurotoxin'), 'botox')
  assert.equal(offerTreatmentRoute('Neurotoxin'), 'botox')
  assert.equal(getCategoryBucket('Neurotoxin')?.slug, 'neurotoxins')
})

test('Skin Tightening and Wellness get real buckets, not Body', () => {
  // 6 Skin Tightening deals (HIFU, Sofwave) and 35 Wellness deals (IV, hormones, weight loss)
  // were badged "Body" on 2026-09-23.
  assert.equal(dbCategoryToTreatment('Skin Tightening'), 'skincare')
  assert.equal(getCategoryBucket('Skin Tightening')?.slug, 'facials-lasers')
  assert.equal(dbCategoryToTreatment('Wellness'), 'wellness')
  assert.equal(getCategoryBucket('Wellness')?.slug, 'wellness')
  assert.equal(dbCategoryToTreatment('Body Contouring'), 'body')
})

test('the two maps cover exactly the same set of DB categories', () => {
  // They are independent maps over one column. Their key sets agreeing is a coincidence until
  // something asserts it.
  const treatmentKeys = new Set(Object.values(TREATMENT_TO_DB).flat())
  const bucketKeys = new Set(Object.keys(CATEGORY_MAP))
  assert.deepEqual(
    [...treatmentKeys].sort(),
    [...bucketKeys].sort(),
    'DB_TO_TREATMENT (via TREATMENT_TO_DB) and CATEGORY_MAP have drifted apart',
  )
})

test('every treatment bucket can actually be queried for', () => {
  const treatments: TreatmentCategory[] = [
    'botox',
    'fillers',
    'facials',
    'laser',
    'body',
    'skincare',
    'wellness',
  ]
  for (const treatment of treatments) {
    assert.ok(
      treatmentToDbCategories(treatment).length > 0,
      `${treatment} owns a route and a guide but maps to no DB category, so its page can only ever be empty`,
    )
  }
})

test('no category, or an unknown one, is no treatment — not body', () => {
  // A null category used to badge "Body" (63 cards on 2026-09-23: IV drips, "10% off
  // injectables"). It is now no badge and no treatment page, and the label and the route agree.
  // Cast on purpose: the point of this test is a value the TYPES have never seen. The
  // database can gain an enum member (and has, three times) between one type regeneration and
  // the next.
  const unknown = 'Cryotherapy' as ClinicServiceCategory
  assert.equal(dbCategoryToTreatment(unknown), null)
  assert.equal(offerTreatmentRoute(unknown), null)
  assert.equal(dbCategoryToTreatment(null), null)
  assert.equal(offerTreatmentRoute(null), null)
  assert.equal(getCategoryBucket(null), null)
})

test('every bucket label takes the right verb in its FAQ', () => {
  // "What should I expect during a Other Services treatment?" and "How much does Fillers" were
  // live; "Wellness" ends in s and is still singular.
  const expected: Record<string, string> = {
    Neurotoxins: 'do',
    Fillers: 'do',
    'Facials & Lasers': 'do',
    Wellness: 'does',
    'Body contouring': 'does',
  }
  for (const { label } of Object.values(CATEGORY_MAP)) {
    assert.equal(treatmentDo(label), expected[label], label)
  }
})
