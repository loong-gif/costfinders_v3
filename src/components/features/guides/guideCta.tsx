import { ArrowRight, BookOpen } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'
import type { GuideEntry } from '@/types/guide'

interface GuideCtaProps {
  treatmentLabel: string
  cityLabel: string
  dealCount: number
  dealsLink: string
  relatedGuides: GuideEntry[]
  treatmentSlug: string
}

export function GuideCta({
  treatmentLabel,
  cityLabel,
  dealCount,
  dealsLink,
  relatedGuides,
  treatmentSlug,
}: GuideCtaProps) {
  // Separate same-treatment (other cities) and same-city (other treatments)
  const otherCities = relatedGuides
    .filter((g) => g.treatment === treatmentSlug && g.city !== dealsLink.split('/').pop())
    .slice(0, 4)
  const otherTreatments = relatedGuides
    .filter((g) => g.treatment !== treatmentSlug)
    .slice(0, 4)

  return (
    <section className="mb-10">
      {/* Primary CTA */}
      <div className="bg-amber-800 rounded-2xl p-8 text-center mb-8">
        <h2 className="text-2xl font-bold text-white mb-2">
          Compare {dealCount} {treatmentLabel} deal
          {dealCount !== 1 ? 's' : ''} in {cityLabel}
        </h2>
        <p className="text-amber-100/80 mb-6">
          See real pricing from verified providers. Claim a deal to get started.
        </p>
        <Link
          href={dealsLink}
          className="inline-flex items-center gap-2 bg-white text-amber-900 font-semibold px-6 py-3 rounded-xl hover:bg-amber-50 transition-colors"
        >
          Browse deals
          <ArrowRight size={18} weight="bold" />
        </Link>
      </div>

      {/* Related guides */}
      {(otherCities.length > 0 || otherTreatments.length > 0) && (
        <div>
          <h3 className="text-lg font-bold text-[#451a03] mb-4">
            Related pricing guides
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {otherCities.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="flex items-center gap-3 bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-4 hover:bg-[#f2ebe2] transition-colors"
              >
                <BookOpen
                  size={18}
                  weight="fill"
                  className="text-amber-800 shrink-0"
                />
                <span className="text-sm font-medium text-[#451a03]">
                  {treatmentLabel} pricing in{' '}
                  {formatCitySlug(guide.city)}
                </span>
              </Link>
            ))}
            {otherTreatments.map((guide) => (
              <Link
                key={guide.slug}
                href={`/guides/${guide.slug}`}
                className="flex items-center gap-3 bg-[#faf5ee] border border-[#d4c4b0] rounded-xl p-4 hover:bg-[#f2ebe2] transition-colors"
              >
                <BookOpen
                  size={18}
                  weight="fill"
                  className="text-amber-800 shrink-0"
                />
                <span className="text-sm font-medium text-[#451a03]">
                  {formatTreatment(guide.treatment)} pricing in{' '}
                  {formatCitySlug(guide.city)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

function formatCitySlug(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function formatTreatment(slug: string): string {
  const labels: Record<string, string> = {
    botox: 'Botox',
    fillers: 'Dermal Fillers',
    facials: 'Facials',
    laser: 'Laser',
    body: 'Body',
    skincare: 'Skincare',
  }
  return labels[slug] ?? slug
}
