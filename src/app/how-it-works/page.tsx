import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalList, LegalSection } from '@/app/legal/legalShell'
import { TIER_ICONS } from '@/components/patterns/treatmentIcons'
import { TIER_LABELS } from '@/lib/data/interpretation'
import {
  TYPICAL_MIN_PRICED_DEALS,
  TYPICAL_MIN_PROVIDERS,
} from '@/lib/data/typicalPrice'
import { buildCanonicalUrl, OG_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata'

/**
 * "How CostFinders works" — .planning/DEAL-BROWSE-AND-TRUST.md § 6.
 *
 * Every sentence here was checked against the code or the live data on 2026-09-28, and it stays
 * present tense: no ingest cadence, no promise about business accounts, nothing about payment or
 * ranking. Where deals come from: all 947 visible offers trace to a `source_url` on the clinic's
 * own site (or a sister domain) — 503 through a promotion page, 444 through a membership page —
 * and none to the social or email staging tables, so "specials and membership pages" is the
 * whole truth, not a softened one. Only 133 of the 947 carry a campaign end date, which is why
 * "ended offers" is on the what-we-can-get-wrong list.
 *
 * The section ids are link targets for the deal page and the browse note; keep them stable.
 */

const DESCRIPTION =
  'Where CostFinders deals come from, how we read clinic offers into prices you can compare, how typical prices are worked out, and how to report a problem.'

export const metadata: Metadata = {
  title: 'How It Works',
  description: DESCRIPTION,
  alternates: {
    canonical: buildCanonicalUrl('/how-it-works'),
  },
  openGraph: {
    images: [OG_IMAGE],
    title: 'How CostFinders works',
    description: DESCRIPTION,
    url: buildCanonicalUrl('/how-it-works'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

const LINK = 'text-accent underline underline-offset-2 hover:text-accent-hover'

/**
 * The three interpretation labels, each with a made-up example in the shapes the rules in
 * src/lib/data/adapters.ts handle: a stated rate, a quantity divided to a per-unit figure
 * (offerPriceBasis + perUnitPrice), and a discount whose price the wording never states
 * (priceIsStated drops the price and dealPricing leads with the discount). The label itself comes
 * from TIER_LABELS; the meaning is worded for this page, which is not about one deal.
 */
const LABELS = [
  {
    tier: 'as-advertised',
    meaning: 'Every figure we show is in the clinic’s own words.',
    says: 'Juvederm lip filler, $599 per syringe',
    shows: '$599 per syringe',
    note: null,
  },
  {
    tier: 'worked-out',
    meaning:
      'We worked something out from the clinic’s wording, and the deal page says what.',
    says: '40 units of Botox for $450',
    shows: '$450 for 40 units',
    note: 'We divide it out to $11.25 per unit so you can compare it.',
  },
  {
    tier: 'check',
    meaning:
      'We couldn’t be sure of the price from the clinic’s wording. Confirm it when you book.',
    says: '$100 off when you buy 40 or more units of Botox',
    shows: '$100 off',
    note: 'No price, because the offer never states one.',
  },
] as const

export default function HowItWorksPage() {
  return (
    <main className="pt-20 pb-20 md:pb-16">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="font-display text-4xl sm:text-5xl font-bold tracking-tight text-text-primary mb-3">
          How CostFinders works
        </h1>
        <p className="text-lg text-text-secondary leading-relaxed mb-10">
          CostFinders lists the prices medspas advertise, side by side. Here is
          where those prices come from, how we read them, and what to check
          before you book.
        </p>

        <div className="space-y-10">
          <LegalSection
            id="where-deals-come-from"
            heading="Where deals come from"
          >
            <p>
              Every deal here comes from an offer a clinic published itself.
              Today that is mostly the specials and membership pages on
              clinics&apos; own websites.
            </p>
            <p>
              We collect those offers from the public pages ourselves, so a
              listing doesn&apos;t mean the clinic works with us or has checked
              it. A deal the clinic has checked says{' '}
              <strong className="text-text-primary">
                Confirmed by the clinic
              </strong>
              .
            </p>
          </LegalSection>

          <LegalSection id="how-we-read-deals" heading="How we read a deal">
            <p>
              Clinics write offers in their own ways: a price per unit, per area
              or per syringe, a package, a member price, a percentage off. We
              read each offer&apos;s own words and show its price in a form you
              can compare. Every deal carries one of three labels.
            </p>

            <ul className="divide-y divide-border-default rounded-xl border border-border-default">
              {LABELS.map((item) => {
                const TierIcon = TIER_ICONS[item.tier]
                return (
                  <li
                    key={item.tier}
                    className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5"
                  >
                    <div>
                      <h3 className="flex items-center gap-1.5 font-display text-base font-semibold text-text-primary">
                        <TierIcon
                          size={16}
                          weight="bold"
                          aria-hidden="true"
                          className="shrink-0"
                        />
                        {TIER_LABELS[item.tier].label}
                      </h3>
                      <p className="mt-1 text-sm">{item.meaning}</p>
                    </div>
                    <div className="rounded-lg bg-bg-surface p-3 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                        The clinic says
                      </p>
                      <p className="mt-1 text-text-primary">“{item.says}”</p>
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
                        We show
                      </p>
                      <p className="mt-1 font-display text-lg font-bold tabular-nums text-text-primary">
                        {item.shows}
                      </p>
                      {item.note && <p className="mt-1">{item.note}</p>}
                    </div>
                  </li>
                )
              })}
            </ul>

            <p>
              In a list of deals, a deal with no label is As advertised. The
              deal page always shows the label, and under How we read this deal
              it quotes the clinic&apos;s words and says what we worked out.
            </p>
            <p>Our math covers five things:</p>
            <LegalList>
              <li>a per-unit price we divided out of a package</li>
              <li>
                a total we multiplied out from a per-unit price and a number of
                units
              </li>
              <li>
                one price for several treatments, listed under one of them
              </li>
              <li>
                a neurotoxin deal that doesn&apos;t name one brand, compared
                against every brand&apos;s prices
              </li>
              <li>
                a percentage off we counted from an offer like &ldquo;buy 2, get
                1 free&rdquo;
              </li>
            </LegalList>
            <p>
              A deal is marked Confirm when booking when the clinic&apos;s words
              don&apos;t state its price or discount, or don&apos;t say what the
              price buys.
            </p>
            <p>
              We show a regular price, or a saving worked out from one, only
              when the clinic&apos;s own words state that regular price.
            </p>
          </LegalSection>

          <LegalSection
            id="typical-prices"
            heading="How “typical” is worked out"
          >
            <p>
              When you browse a city&apos;s neurotoxin deals, a deal can say how
              it compares with the typical price there, such as &ldquo;32% below
              typical&rdquo;. Typical is the median, the middle value, of the
              per-unit prices listed for neurotoxins in that city.
            </p>
            <LegalList>
              <li>
                Neurotoxins compare per unit: &ldquo;40 units for $450&rdquo;
                counts as $11.25 per unit. A neurotoxin deal priced per area, or
                with no number of units to divide by, doesn&apos;t count.
              </li>
              <li>
                We show a typical price only when at least{' '}
                {TYPICAL_MIN_PRICED_DEALS} deals from at least{' '}
                {TYPICAL_MIN_PROVIDERS} clinics have a comparable price.
              </li>
              <li>Deals marked Confirm when booking never count.</li>
              <li>
                A starting price (&ldquo;from $9 per unit&rdquo;) doesn&apos;t
                count and isn&apos;t compared: it is the lowest the clinic
                charges, not what you pay.
              </li>
              <li>
                Dysport doesn&apos;t count and isn&apos;t compared. A Dysport
                unit is smaller than a Botox unit, so its per-unit price
                isn&apos;t a like-for-like figure.
              </li>
            </LegalList>
            <p>
              The neurotoxin figure pools every other brand, so it is a typical
              neurotoxin price, not a typical Botox price. Where the lowest
              price is a brand other than Botox, we name the brand. The same
              prices count toward every neurotoxin median we show across brands,
              on the homepage and in the cost guides.
            </p>
            <p>
              Other treatments have no typical price. Under one treatment,
              clinics list things that cost very different amounts: one vial of
              a skin treatment beside a package of three sessions, or one
              syringe of filler beside several syringes or a vial of Sculptra.
              The middle of those isn&apos;t a price anyone pays, so for other
              treatments we show the lowest price listed and no comparison.
            </p>
          </LegalSection>

          <LegalSection
            id="what-we-can-get-wrong"
            heading="What we can get wrong"
          >
            <LegalList>
              <li>
                <strong className="text-text-primary">Units and areas.</strong>{' '}
                Some clinics price neurotoxins by the area treated, not by the
                unit. An area isn&apos;t a set number of units, so we don&apos;t
                convert it, and those deals aren&apos;t compared per unit.
              </li>
              <li>
                <strong className="text-text-primary">
                  Dysport and Botox units.
                </strong>{' '}
                Dysport and Botox units aren&apos;t the same size. A treatment
                usually takes more Dysport units, so Dysport&apos;s per-unit
                price looks lower. That is why Dysport is left out of the
                typical price. Compare brands with that in mind.
              </li>
              <li>
                <strong className="text-text-primary">Packages.</strong> When
                one price covers several treatments, we list it under one of
                them and the price is for the whole package. Outside
                neurotoxins, sorting by price puts a package beside a single
                session.
              </li>
              <li>
                <strong className="text-text-primary">Membership fees.</strong>{' '}
                A member price also needs a paid membership. Lists mark these
                &ldquo;for members&rdquo;. The deal page shows the fee, how
                often it&apos;s billed and any minimum commitment when the
                clinic publishes them, and says so when it doesn&apos;t.
              </li>
              <li>
                <strong className="text-text-primary">Ended offers.</strong> We
                take a deal down once the end date the clinic published has
                passed. Most offers don&apos;t publish one, so a deal can stay
                listed after the clinic stops offering it.
              </li>
              <li>
                <strong className="text-text-primary">Conditions.</strong> We
                show the conditions we can read, such as new customers only or a
                required membership. Offers often carry more fine print, like
                minimum units or one per person. Ask the clinic when you book.
              </li>
            </LegalList>
            <p>
              If a deal looks wrong,{' '}
              <Link href="#report-a-problem" className={LINK}>
                report it
              </Link>
              .
            </p>
          </LegalSection>

          <LegalSection
            id="why-names-are-hidden"
            heading="Why clinic names are hidden"
          >
            <p>
              Clinic names stay hidden until you claim a deal, so you compare
              deals on price and terms first, and a clinic&apos;s details go to
              people who have asked about its deal. Until then we also leave out
              anything that would point to the clinic, such as its name in the
              offer&apos;s wording and its Google rating.
            </p>
            <p>
              To claim, you sign in and give your name and phone number. The
              claim shows you the clinic&apos;s name, address, phone number and
              website. When you claim, we share your name and contact details
              with the clinic: our team passes your request on to them.
            </p>
          </LegalSection>

          <LegalSection id="report-a-problem" heading="Report a problem">
            <p>
              Every deal page has Report a problem under How we read this deal.
              Choose what&apos;s wrong (the price is wrong, the deal has ended,
              the clinic wouldn&apos;t honor it, the terms are different, or
              something else) and add a note if you like. You don&apos;t need an
              account. Reports go to our team, who can correct a deal or take it
              off the site.
            </p>
            <p>
              After you claim a deal,{' '}
              <Link href="/dashboard/claims" className={LINK}>
                your claims page
              </Link>{' '}
              asks whether the clinic honored the price.
            </p>
          </LegalSection>

          <LegalSection
            id="for-clinics"
            heading="How clinics confirm or correct a deal"
          >
            <p>
              A clinic with a CostFinders business account sees its deals on its{' '}
              <Link href="/business/dashboard/deals" className={LINK}>
                business dashboard
              </Link>
              . For each one it can confirm we have it right or suggest a
              correction. A confirmed deal says Confirmed by the clinic, and the
              deal page gives the date, until its price or wording changes.
              Corrections go to our team to review. If the clinic&apos;s own
              page changes later, the listing can change with it.
            </p>
            <p>
              Most clinics don&apos;t have a business account. Any clinic can
              ask us to correct a deal, fix a price, or add or remove its
              listing with the{' '}
              <Link
                href="/business/listing-request?type=correct"
                className={LINK}
              >
                listing change form
              </Link>
              . A person reviews every request.
            </p>
          </LegalSection>

          <p>
            <Link href="/deals" className={LINK}>
              Browse deals
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
