import { ArrowRight, MapPin } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import { BreadcrumbSchema, GuidesHubSchema } from '@/components/seo'
import { Breadcrumb } from '@/components/ui/breadcrumb'
import { formatPrice } from '@/lib/data/adapters'
import { getGuideSummaries } from '@/lib/data/guide-content'
import { getGuideIndexStats } from '@/lib/data/guide-stats'
import { floorBrandText } from '@/lib/data/typicalPrice'
import {
  buildCanonicalUrl,
  generateGuidesHubMetadata,
  SITE_CONFIG,
} from '@/lib/seo/metadata'
import type { GuideIndexStat, GuideSummary } from '@/types/guide'

export const revalidate = 86400 // ISR: regenerate every 24 hours

export function generateMetadata() {
  const guides = getGuideSummaries()
  return generateGuidesHubMetadata(guides.length, countCities(guides))
}

export default async function GuidesHubPage() {
  const guides = getGuideSummaries()
  const stats = await getGuideIndexStats(guides)
  const byState = groupByState(guides)
  const cityCount = countCities(guides)

  return (
    <>
      <BreadcrumbSchema
        items={[
          { name: 'Home', url: SITE_CONFIG.url },
          { name: 'Cost Guides', url: buildCanonicalUrl('/guides') },
        ]}
      />
      <GuidesHubSchema
        guides={guides.map((guide) => ({
          slug: guide.slug,
          name: `${guide.treatmentLabel} cost in ${guide.cityLabel}, ${guide.stateCode}`,
        }))}
      />

      <main className="pt-20 pb-20 md:pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumb
            items={[{ label: 'Home', href: '/' }, { label: 'Cost Guides' }]}
          />

          <header className="mb-10">
            <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-3">
              Medspa treatment cost guides
            </h1>
            <p className="text-lg text-text-secondary max-w-2xl">
              {guides.length} city-level cost guides across {cityCount}{' '}
              {cityCount === 1 ? 'market' : 'markets'}. Each one explains what
              that treatment costs locally, what moves the cost, and what
              providers near you advertise.
            </p>
          </header>

          {byState.map(({ state, cities }) => (
            <section
              aria-labelledby={`state-${slugify(state)}`}
              className="mb-12"
              key={state}
            >
              <h2
                className="font-display text-2xl font-bold tracking-tight text-text-primary mb-5"
                id={`state-${slugify(state)}`}
              >
                {state}
              </h2>

              {cities.map((city) => (
                <div className="mb-7" key={city.citySlug}>
                  <h3 className="flex items-center gap-2 text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
                    <MapPin size={16} weight="fill" />
                    {city.cityLabel}, {city.stateCode}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {city.entries.map((guide) => (
                      <GuideCard
                        guide={guide}
                        key={guide.slug}
                        stat={stats.get(guide.slug)}
                      />
                    ))}
                  </div>
                  <Link
                    className="inline-flex items-center min-h-[44px] mt-1 text-sm font-medium text-accent hover:text-accent-hover transition-colors"
                    href={`/deals/${city.citySlug}`}
                  >
                    Browse every medspa deal in {city.cityLabel}
                  </Link>
                </div>
              ))}
            </section>
          ))}
        </div>
      </main>
    </>
  )
}

function GuideCard({
  guide,
  stat,
}: {
  guide: GuideSummary
  stat: GuideIndexStat | undefined
}) {
  return (
    <Link
      className="group flex items-center justify-between gap-3 bg-bg-elevated border border-border-default rounded-xl p-4 hover:border-border-hover hover:shadow-md transition-all"
      href={`/guides/${guide.slug}`}
    >
      <span>
        <span className="block font-display text-base font-semibold text-text-primary group-hover:text-accent transition-colors">
          {guide.treatmentLabel} cost in {guide.cityLabel}
        </span>
        {stat && stat.dealCount > 0 && (
          <span className="block text-xs text-text-muted mt-0.5">
            {stat.dealCount} {stat.dealCount === 1 ? 'deal' : 'deals'} from{' '}
            {stat.providerCount}{' '}
            {stat.providerCount === 1 ? 'provider' : 'providers'}
            {/* As on the guide itself: cents on any per-unit figure ($10.50 is not "$11") and below
                $10; whole dollars on a package. */}
            {stat.floorPrice != null && (
              <>
                , from{' '}
                {/* Price with its unit, and "· lowest is X", each wrap whole: at 320px the line
                    ended "lowest is" and left "Dysport" alone below (2026-09-28). */}
                <span className="whitespace-nowrap">
                  {formatPrice(
                    stat.perUnit || stat.floorPrice < 10
                      ? stat.floorPrice
                      : Math.round(stat.floorPrice),
                  )}
                  {stat.perUnit && ' per unit'}
                </span>
                {/* The floor, as the guide's "Starting at" and the deals page print it: any
                    brand, a Dysport unit named. */}
                {floorBrandText(stat.floorBrand) && (
                  <>
                    {' '}
                    <span className="whitespace-nowrap">
                      {floorBrandText(stat.floorBrand).trim()}
                    </span>
                  </>
                )}
              </>
            )}
          </span>
        )}
      </span>
      <ArrowRight
        className="text-text-muted shrink-0 group-hover:text-accent transition-colors"
        size={18}
        weight="bold"
      />
    </Link>
  )
}

interface CityGroup {
  cityLabel: string
  citySlug: string
  stateCode: string
  entries: GuideSummary[]
}

function countCities(guides: GuideSummary[]): number {
  return new Set(guides.map((g) => `${g.city}|${g.stateCode}`)).size
}

/**
 * State -> city -> guides. getGuideSummaries() already sorts by state, then city, then
 * treatment, so a single insertion-ordered pass preserves that order without re-sorting.
 */
function groupByState(
  guides: GuideSummary[],
): Array<{ state: string; cities: CityGroup[] }> {
  const states = new Map<string, Map<string, CityGroup>>()

  for (const guide of guides) {
    const cities = states.get(guide.state) ?? new Map<string, CityGroup>()
    const city = cities.get(guide.city) ?? {
      cityLabel: guide.cityLabel,
      citySlug: guide.city,
      stateCode: guide.stateCode,
      entries: [],
    }
    city.entries.push(guide)
    cities.set(guide.city, city)
    states.set(guide.state, cities)
  }

  return Array.from(states.entries()).map(([state, cities]) => ({
    state,
    cities: Array.from(cities.values()),
  }))
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}
