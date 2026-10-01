import { Stethoscope } from '@phosphor-icons/react/dist/ssr'
import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ContactEmail,
  Fact,
  LegalList,
  LegalPage,
  LegalSection,
} from '@/app/legal/legalShell'
import { COMPANY_FACTS } from '@/lib/legal/companyFacts'
import { buildCanonicalUrl, OG_IMAGE, SITE_CONFIG } from '@/lib/seo/metadata'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms governing your use of CostFinders, including our medical disclaimer, how deal claims work, and the limits of our role as a referral platform.',
  alternates: {
    canonical: buildCanonicalUrl('/terms'),
  },
  openGraph: {
    images: [OG_IMAGE],
    title: 'Terms of Service',
    description:
      'The terms governing your use of CostFinders, including our medical disclaimer and how deal claims work.',
    url: buildCanonicalUrl('/terms'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

export default function TermsOfServicePage() {
  return (
    <LegalPage
      title="Terms of Service"
      intro="These terms govern your use of CostFinders. Read them carefully — they include a medical disclaimer, limits on our liability, and an explanation of what happens when you claim a deal."
    >
      <LegalSection id="acceptance" heading="1. Acceptance of these terms">
        <p>
          By accessing or using CostFinders, you agree to these Terms of Service
          and to our{' '}
          <Link
            href="/privacy"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Privacy Policy
          </Link>
          . If you do not agree, do not use the service.
        </p>
        <p>
          You must be at least 18 years old and able to form a binding contract
          to create an account or claim a deal. If you use CostFinders on behalf
          of a business, you represent that you are authorized to bind that
          business to these terms.
        </p>
        <p>
          &quot;CostFinders&quot;, &quot;we&quot;, and &quot;us&quot; means{' '}
          <Fact value={COMPANY_FACTS.legalName} />, a{' '}
          <Fact value={COMPANY_FACTS.entityType} /> registered in{' '}
          <Fact value={COMPANY_FACTS.registeredState} />.
        </p>
      </LegalSection>

      <LegalSection id="what-we-are" heading="2. What CostFinders is">
        <p>
          CostFinders is an information and referral platform. We publish
          treatment and pricing information about medical spas in the United
          States. When you claim a deal, we show you the provider&apos;s contact
          details and pass your request on to that provider.
        </p>
        <p>
          <strong className="text-text-primary">
            We are not a party to any transaction between you and a business.
          </strong>{' '}
          We do not provide, schedule, supervise, endorse, license, or guarantee
          any treatment. We do not employ, contract with, or control the
          providers listed on the site, and we do not verify the qualifications,
          licensure, insurance, or safety record of any provider or the
          individuals who work there. Any appointment, price, payment, refund,
          or dispute is strictly between you and the business.
        </p>
        <p>
          No business pays CostFinders today. CostFinders may be compensated by
          businesses for referrals in the future. Payment would not be an
          endorsement, a certification of quality, or a recommendation, and it
          would not change the pricing information we publish.
        </p>
      </LegalSection>

      <LegalSection id="medical-disclaimer" heading="3. Medical disclaimer">
        <div className="rounded-xl bg-bg-surface p-5 sm:p-6">
          <div className="flex gap-4">
            <Stethoscope
              size={24}
              weight="fill"
              className="text-text-muted shrink-0 mt-0.5"
            />
            <div className="space-y-4">
              <p>
                <strong className="text-text-primary">
                  CostFinders is not a medical provider and does not give
                  medical advice.
                </strong>{' '}
                Nothing on this site — including treatment descriptions,
                category pages, pricing guides, comparisons, deal listings, or
                any message from us — is medical advice, diagnosis, treatment,
                or a professional recommendation. It is general consumer
                information about the cost of aesthetic services.
              </p>
              <p>
                <strong className="text-text-primary">
                  No provider-patient relationship is created.
                </strong>{' '}
                Using CostFinders, creating an account, or submitting a claim
                does not create a physician-patient, nurse-patient, or any other
                clinical relationship between you and CostFinders.
              </p>
              <p>
                <strong className="text-text-primary">
                  Consult a qualified provider before any treatment.
                </strong>{' '}
                Aesthetic and cosmetic procedures — including injectables, laser
                treatments, and body contouring — are medical procedures that
                carry risks, contraindications, and outcomes that vary by
                individual. Only a licensed provider who has evaluated you can
                determine whether a treatment is appropriate, safe, and
                medically indicated for you. Always seek the advice of a
                licensed physician or other qualified health professional with
                any questions about a medical condition or procedure. Never
                disregard professional medical advice, or delay seeking it,
                because of something you read on CostFinders.
              </p>
              <p>
                <strong className="text-text-primary">
                  If you have a medical emergency, call 911 or go to the nearest
                  emergency room.
                </strong>{' '}
                Do not use CostFinders to report a medical emergency or an
                adverse reaction to a treatment. Contact your provider or
                emergency services.
              </p>
              <p>
                <strong className="text-text-primary">
                  We do not screen for medical suitability.
                </strong>{' '}
                A price shown on this site says nothing about whether the
                treatment is right for you. Please do not send us medical
                history or clinical information; discuss it with your provider.
              </p>
            </div>
          </div>
        </div>
      </LegalSection>

      <LegalSection id="pricing" heading="4. Pricing information">
        <p>
          Prices on CostFinders are informational only.{' '}
          <strong className="text-text-primary">
            They are not an offer, quote, guarantee, or contract for treatment
            at that price.
          </strong>{' '}
          Only the business can make you a binding offer, and only after it has
          evaluated you.
        </p>
        <LegalList>
          <li>
            Prices are collected from providers&apos; public websites and public
            business listings, and may be outdated, incomplete, or incorrect.
          </li>
          <li>
            Actual cost depends on factors we cannot see — the units or sessions
            you need, the product used, the provider performing the treatment,
            add-on services, taxes and fees, and the business&apos; own current
            promotions.
          </li>
          <li>
            Advertised regular prices and discounted prices are the
            business&apos; representations, not ours. We do not independently
            verify that a discount reflects a genuine prior price.
          </li>
          <li>
            A business may change or withdraw a price at any time, may limit
            availability, and may decline to honor a listed price.
          </li>
        </LegalList>
        <p>
          If you find a price on this site that is wrong, please tell us at{' '}
          <ContactEmail /> so we can correct it.
        </p>
      </LegalSection>

      <LegalSection id="claims" heading="5. Claiming a deal">
        <p>
          Submitting a claim shows you the provider&apos;s name and contact
          details, and asks our team to pass your request on to that provider.
          It is not a booking, a reservation, or a confirmed appointment, and it
          does not obligate the business to contact you, offer the price, or
          provide the treatment.
        </p>
        <p>
          <strong className="text-text-primary">
            A claim shares your contact details with that business.
          </strong>{' '}
          When you submit a claim, our team passes the provider your name, email
          address, phone number, your preferred date and time, and any note you
          wrote — by phone, by email, through its website form, or by messaging
          its social media account. The provider then holds that information
          under its own privacy practices, and may contact you by phone, text,
          or email. We cannot recall information already passed on. This is
          described in full in our{' '}
          <Link
            href="/privacy"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <p>
          Open claims expire, and we limit the number of open claims a single
          account may hold at one time to prevent abuse. Submitting claims you
          do not intend to act on, or using claims to harvest business contact
          information, is a violation of these terms.
        </p>
        <p>
          Any deposit, payment, cancellation policy, no-show fee, or refund is
          set and administered by the business. CostFinders does not process
          payments for treatments and has no authority to issue refunds on a
          business&apos; behalf.
        </p>
      </LegalSection>

      <LegalSection id="accounts" heading="6. Your account">
        <LegalList>
          <li>
            Provide accurate information and keep it current. Do not impersonate
            anyone or create an account for someone else without authorization.
          </li>
          <li>
            You are responsible for keeping your credentials confidential and
            for activity under your account. Tell us promptly at{' '}
            <ContactEmail /> if you suspect unauthorized use.
          </li>
          <li>
            One account per person. We may suspend or close accounts that
            violate these terms.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="acceptable-use" heading="7. Acceptable use">
        <p>You agree not to:</p>
        <LegalList>
          <li>
            Scrape, crawl, harvest, or bulk-download pricing, business, or user
            data, or use automated means to access the service beyond ordinary
            browsing.
          </li>
          <li>
            Submit false, fraudulent, or spam claims, messages, or listing
            requests.
          </li>
          <li>
            Post content that is unlawful, defamatory, harassing, hateful,
            sexually explicit, deceptive, or that infringes someone&apos;s
            rights.
          </li>
          <li>
            Use the platform to solicit users for unrelated products or
            services, or to send unsolicited commercial messages.
          </li>
          <li>
            Interfere with, probe, or attempt to gain unauthorized access to the
            service, other accounts, or our infrastructure.
          </li>
          <li>
            Misrepresent a treatment&apos;s medical effects, or use the platform
            to make medical claims that violate FDA, FTC, or state law.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="business-users" heading="8. Terms for businesses">
        <p>
          If you hold a business account or ask us to change a listing, you also
          agree that:
        </p>
        <LegalList>
          <li>
            You are authorized to act for the business, and what you tell us
            about it is true.
          </li>
          <li>
            All pricing and service descriptions you give us or edit are
            accurate, current, not misleading, and comply with applicable
            advertising, licensing, and healthcare marketing law — including FTC
            rules on advertised discounts and state rules on the advertising of
            medical services.
          </li>
          <li>
            You hold, and will maintain, all licenses, registrations,
            supervision arrangements, and insurance required to offer the
            services you list.
          </li>
          <li>
            You will use consumer contact details received through CostFinders
            only to respond to that consumer&apos;s inquiry, will handle them in
            compliance with applicable privacy and anti-spam law including the
            TCPA, and will honor opt-out requests. You will not sell or transfer
            them to a third party.
          </li>
          <li>
            You grant CostFinders a non-exclusive, royalty-free license to
            display your business name, listing content, images, and pricing on
            the platform and in related promotion.
          </li>
          <li>
            You are solely responsible for the treatments you provide and for
            any dispute with a consumer.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="user-content" heading="9. Content you submit">
        <p>
          You retain ownership of the content you submit — messages, notes, and
          listing details. You grant CostFinders a worldwide, non-exclusive,
          royalty-free license to host, store, reproduce, and display that
          content for the purpose of operating and promoting the service. You
          represent that you have the rights necessary to grant that license.
        </p>
        <p>
          We may remove content that violates these terms, but we are not
          obligated to monitor, and we do not endorse any user or business
          content.
        </p>
      </LegalSection>

      <LegalSection
        id="third-parties"
        heading="10. Third-party sites and content"
      >
        <p>
          The service links to business websites, social profiles, and other
          third-party resources. We do not control them, we are not responsible
          for their content, practices, or privacy policies, and a link is not
          an endorsement. Your dealings with any third party are solely between
          you and that party.
        </p>
      </LegalSection>

      <LegalSection id="ip" heading="11. Intellectual property">
        <p>
          The CostFinders name, logo, site design, original content, and the
          selection and arrangement of the data on the site are owned by
          CostFinders or its licensors and are protected by intellectual
          property law. These terms grant you a limited, revocable,
          non-transferable license to use the service for personal,
          non-commercial purposes. All other rights are reserved.
        </p>
      </LegalSection>

      <LegalSection id="disclaimer" heading="12. Disclaimer of warranties">
        <p>
          THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS
          AVAILABLE&quot;, WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED,
          INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
          PARTICULAR PURPOSE, TITLE, AND NON-INFRINGEMENT.
        </p>
        <p>
          We do not warrant that pricing, business, or treatment information is
          accurate, complete, or current; that any business will respond to a
          claim or honor a listed price; that any provider is licensed,
          qualified, insured, or competent; or that the service will be
          uninterrupted or error-free. Some jurisdictions do not allow the
          exclusion of certain warranties, so parts of this section may not
          apply to you.
        </p>
      </LegalSection>

      <LegalSection id="liability" heading="13. Limitation of liability">
        <p>
          TO THE MAXIMUM EXTENT PERMITTED BY LAW, COSTFINDERS AND ITS OFFICERS,
          EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL,
          SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR FOR ANY LOSS OF
          PROFITS, DATA, OR GOODWILL, ARISING OUT OF YOUR USE OF THE SERVICE.
        </p>
        <p>
          WE ARE NOT LIABLE FOR ANY INJURY, ADVERSE OUTCOME, MALPRACTICE,
          MISREPRESENTATION, OVERCHARGE, OR OTHER HARM ARISING FROM A TREATMENT
          YOU OBTAIN FROM A BUSINESS FOUND THROUGH COSTFINDERS, OR FROM A
          BUSINESS&apos; HANDLING OF YOUR CONTACT INFORMATION AFTER A CLAIM IS
          RELAYED. YOUR SOLE REMEDY IN THAT CASE IS AGAINST THE BUSINESS.
        </p>
        <p>
          OUR TOTAL AGGREGATE LIABILITY FOR ANY CLAIM RELATING TO THE SERVICE
          WILL NOT EXCEED THE GREATER OF THE AMOUNT YOU PAID US IN THE TWELVE
          MONTHS BEFORE THE CLAIM OR <Fact value={COMPANY_FACTS.liabilityCap} />
          .
        </p>
        <p>
          Nothing in these terms limits liability that cannot be limited by law,
          including liability for gross negligence, fraud, or personal injury
          caused by our own willful misconduct. Some jurisdictions do not allow
          the limitation of incidental or consequential damages, so parts of
          this section may not apply to you.
        </p>
      </LegalSection>

      <LegalSection id="indemnity" heading="14. Indemnification">
        <p>
          You agree to indemnify and hold harmless CostFinders from any claim,
          loss, liability, or expense (including reasonable legal fees) arising
          from your use of the service, your content, your violation of these
          terms, or your violation of any law or third-party right.
        </p>
      </LegalSection>

      <LegalSection id="termination" heading="15. Suspension and termination">
        <p>
          You may delete your account at any time in Settings. We may suspend or
          terminate your access, with or without notice, if you breach these
          terms, if we suspect fraud or abuse, or if we are required to by law.
          Sections that by their nature should survive termination — including
          intellectual property, disclaimers, limitation of liability,
          indemnification, and governing law — will survive.
        </p>
        <p>
          We may modify, suspend, or discontinue any part of the service at any
          time.
        </p>
      </LegalSection>

      <LegalSection id="governing-law" heading="16. Governing law and disputes">
        <p>
          These terms are governed by the laws of the State of{' '}
          <Fact value={COMPANY_FACTS.governingLawState} />, without regard to
          its conflict-of-laws rules. Any dispute will be brought exclusively in
          the state or federal courts located in{' '}
          <Fact value={COMPANY_FACTS.venue} />, and you consent to personal
          jurisdiction there.
        </p>
        {COMPANY_FACTS.arbitration === false ? (
          <p>
            No arbitration agreement or class-action waiver applies to these
            terms.
          </p>
        ) : (
          <p>
            Arbitration and class-action waiver:{' '}
            <Fact value={COMPANY_FACTS.arbitration} />
            {COMPANY_FACTS.arbitration === null &&
              ' No arbitration agreement or class-action waiver is in effect unless and until counsel adds one and it is presented to you for acceptance.'}
          </p>
        )}
        <p>
          Before filing a claim, please contact us at <ContactEmail /> so we can
          try to resolve it informally.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="17. Changes to these terms">
        <p>
          We may update these terms as the service changes. We will update the
          &quot;Last updated&quot; date at the top of this page, and for
          material changes we will provide notice by email or in the product
          before they take effect. Continuing to use the service after a change
          takes effect means you accept the revised terms.
        </p>
      </LegalSection>

      <LegalSection id="general" heading="18. General">
        <p>
          These terms and the Privacy Policy are the entire agreement between
          you and CostFinders regarding the service. If any provision is found
          unenforceable, the rest remains in effect. Our failure to enforce a
          provision is not a waiver. You may not assign these terms; we may
          assign them in connection with a merger, acquisition, or sale of
          assets.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="19. Contact us">
        <div className="rounded-2xl border border-border-default bg-bg-elevated p-5 space-y-1">
          <p>
            <Fact value={COMPANY_FACTS.legalName} /> (&quot;CostFinders&quot;)
          </p>
          <p>
            <Fact value={COMPANY_FACTS.postalAddress} />
          </p>
          <p>
            Email: <ContactEmail />
          </p>
          {COMPANY_FACTS.phone !== false && (
            <p>
              Phone: <Fact value={COMPANY_FACTS.phone} />
            </p>
          )}
        </div>
        <p>
          See also our{' '}
          <Link
            href="/privacy"
            className="text-accent underline underline-offset-2 hover:text-accent-hover"
          >
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
