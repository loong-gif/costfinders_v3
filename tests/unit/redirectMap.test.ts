/**
 * The v1 → v2 cutover redirect map, held against the two ways it can break the live site.
 *
 * costfinders.ai serves v1 today. The rules in next.config.ts only take effect the moment the
 * domain is pointed at this project, so nobody can click through them first — the two failure
 * modes below would both be discovered in production, by visitors:
 *
 *   1. A LOOP. `/treatments/fillers` is the one slug both versions share; a bare rule for it
 *      would redirect to itself forever. The map is generated from a slug table, so adding a
 *      slug is one line and re-arming this is one omission.
 *   2. A SHADOWED ROUTE. `redirects()` runs before routing, so a rule whose source matches a
 *      URL v2 actually serves takes that page off the site — permanently, at 308, which
 *      browsers and Google cache hard. `/treatments/:category` and `/[state]/[city]` are
 *      dynamic, so a plausible-looking new rule can cover live pages without looking like it.
 *
 * The live set is the fixture, not the route table: `/california/los-angeles` matches the
 * `/[state]/[city]` pattern and is still safe to redirect precisely because
 * generateStaticParams never emits it. Only concrete URLs can tell those two apart.
 */
import { strict as assert } from 'node:assert'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import nextConfig from '../../next.config'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

/**
 * Every URL the production sitemap served on 2026-09-30 (1,568 paths across 15 states; the
 * sitemap lists only cities with deals). A point-in-time capture, the same way
 * supabase/schema-snapshot.json is; refresh it with (`sed -E`: BSD sed has no `\?`)
 *
 *   curl -s https://costfindersv2.vercel.app/sitemap.xml \
 *     | grep -o '<loc>[^<]*</loc>' | sed -E -e 's#</?loc>##g' -e 's#^https?://[^/]*##' \
 *     | sed 's|^$|/|' | sort -u > tests/fixtures/v2-live-paths.txt
 *
 * Staleness is safe in the direction that matters — a URL added since is simply unchecked. A
 * rule that collides with a since-removed URL fails here and wants a human to look, which is
 * the right outcome for a permanent redirect.
 */
const LIVE_PATHS = readFileSync(
  join(REPO, 'tests', 'fixtures', 'v2-live-paths.txt'),
  'utf8',
)
  .split('\n')
  .filter(Boolean)

/**
 * `/treatments/botox/:state` → the paths it captures. Mirrors path-to-regexp's `:param`. A
 * param's `(…)` constraint is dropped first, so the param over-matches; escaped as-is it matched
 * nothing and the shadow check below was blind to every constrained rule.
 */
function sourceMatcher(source: string): RegExp {
  const escaped = source
    .replace(/(:[a-zA-Z]\w*)\([^/]*\)/g, '$1')
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace(/:[a-zA-Z]\w*/g, '[^/]+')}$`)
}

type Redirect = { source: string; destination: string; permanent?: boolean }

async function redirects(): Promise<Redirect[]> {
  const rules = await nextConfig.redirects?.()
  assert.ok(rules?.length, 'next.config.ts declares no redirects')
  return rules as Redirect[]
}

test('no rule redirects to itself', async () => {
  for (const rule of await redirects()) {
    assert.notEqual(
      rule.source,
      rule.destination,
      `${rule.source} redirects to itself — an infinite loop at the edge`,
    )
    assert.ok(
      !sourceMatcher(rule.source).test(rule.destination),
      `${rule.source} matches its own destination ${rule.destination} — an infinite loop at the edge`,
    )
  }
})

test('no rule shadows a URL v2 serves', async () => {
  for (const rule of await redirects()) {
    const matcher = sourceMatcher(rule.source)
    const shadowed = LIVE_PATHS.filter((path) => matcher.test(path))
    assert.deepEqual(
      shadowed,
      [],
      `rule ${rule.source} → ${rule.destination} takes ${shadowed.length} live page(s) off the site, starting with ${shadowed[0]}`,
    )
  }
})

test('every rule is permanent, and every destination is a live page', async () => {
  const live = new Set(LIVE_PATHS)
  for (const rule of await redirects()) {
    assert.equal(
      rule.permanent,
      true,
      `${rule.source} is a temporary redirect; the cutover is permanent (308)`,
    )
    assert.ok(
      live.has(rule.destination),
      `${rule.source} points at ${rule.destination}, which v2 does not serve — that is a redirect to a 404`,
    )
  }
})
