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
  title: 'Privacy Policy',
  description:
    'How CostFinders collects, uses, and shares your personal information — including what happens to your contact details when you claim a medspa deal.',
  alternates: {
    canonical: buildCanonicalUrl('/privacy'),
  },
  openGraph: {
    images: [OG_IMAGE],
    title: 'Privacy Policy',
    description:
      'How CostFinders collects, uses, and shares your personal information, and the choices you have.',
    url: buildCanonicalUrl('/privacy'),
    siteName: SITE_CONFIG.name,
    type: 'website',
  },
}

const LINK = 'text-accent underline underline-offset-2 hover:text-accent-hover'

function DoNotSellLink() {
  return (
    <Link href="/privacy/do-not-sell" className={LINK}>
      Do Not Sell or Share My Personal Information
    </Link>
  )
}

export default function PrivacyPolicyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what personal information CostFinders collects, why we collect it, who we share it with, and the choices you have over it."
    >
      <LegalSection id="who-we-are" heading="1. Who this policy covers">
        <p>
          CostFinders is a price-comparison and referral service for medical
          spas in the United States. We publish the treatment prices providers
          advertise, collected from providers&apos; public websites and public
          business listings, and we help people who want a treatment get in
          touch with the provider offering it. This policy applies to the
          CostFinders website, the emails we send, and any other service that
          links to it.
        </p>
        <p>
          It applies to people who browse and claim deals, to providers who ask
          us to add, correct or remove a listing, and to providers who hold a
          business account. The service is intended for use in the United States
          only.
        </p>
        <p>
          <strong className="text-text-primary">
            CostFinders is not a healthcare provider.
          </strong>{' '}
          We do not deliver treatment, we do not create or hold medical records,
          and we are not a HIPAA covered entity or business associate. Please do
          not send us medical history, diagnoses, or other clinical details —
          share those directly with a licensed provider. Some state laws do
          treat interest in a treatment as health data; section 5 explains how
          we handle it.
        </p>
      </LegalSection>

      <LegalSection id="what-we-collect" heading="2. Information we collect">
        <p>
          <strong className="text-text-primary">
            Information you give us directly:
          </strong>
        </p>
        <LegalList>
          <li>
            <strong className="text-text-primary">Account information</strong> —
            first name, last name, email address, and password credentials
            handled by our authentication provider.
          </li>
          <li>
            <strong className="text-text-primary">Phone number</strong> —
            optional on your profile, and required when you claim a deal so the
            provider can reach you.
          </li>
          <li>
            <strong className="text-text-primary">Profile details</strong> —
            city and state, the deals you save, and your email notification
            setting.
          </li>
          <li>
            <strong className="text-text-primary">Deal claim details</strong> —
            which deal and provider you claimed, your preferred appointment date
            and time, and any note you add for the provider.
          </li>
          <li>
            <strong className="text-text-primary">Messages</strong> — the
            content of messages you exchange with a provider through CostFinders
            (possible only with a provider that holds a business account), and
            any support correspondence with us.
          </li>
          <li>
            <strong className="text-text-primary">Provider requests</strong> —
            for providers, the name, email address, role and details you give us
            when you ask us to add, correct or remove a listing, or when you
            hold a business account.
          </li>
          <li>
            <strong className="text-text-primary">Privacy requests</strong> —
            the email address and message you send through our <DoNotSellLink />{' '}
            form.
          </li>
        </LegalList>

        <p>
          <strong className="text-text-primary">
            Information we collect automatically:
          </strong>
        </p>
        <LegalList>
          <li>
            <strong className="text-text-primary">Usage and device data</strong>{' '}
            — pages viewed, referring page, approximate location derived from IP
            address, browser and device type, and timestamps.
          </li>
          <li>
            <strong className="text-text-primary">Performance data</strong> —
            page load and responsiveness measurements.
          </li>
          <li>
            <strong className="text-text-primary">Session cookies</strong> — set
            by our authentication provider to keep you signed in.
          </li>
        </LegalList>

        <p>
          <strong className="text-text-primary">
            Information from other sources:
          </strong>{' '}
          business names, addresses, phone numbers, categories, websites, social
          profiles, Google ratings and review counts, and advertised pricing,
          collected from providers&apos; public websites and public business
          listings. This is business information, not consumer personal
          information.
        </p>

        <p>
          We do not ask for and do not want payment card numbers, Social
          Security numbers, government ID numbers, or clinical records. Payment
          for any treatment happens directly between you and the provider.
        </p>
      </LegalSection>

      <LegalSection id="how-we-use" heading="3. How we use your information">
        <LegalList>
          <li>To create and maintain your account and keep you signed in.</li>
          <li>
            To show you a provider&apos;s name and contact details when you
            claim one of its deals, and to pass your request on to that provider
            (see section 4).
          </li>
          <li>
            To send email about your account and your claims — claim
            confirmations, word that we passed your request on, sign-in links,
            and account or security notices.
          </li>
          <li>
            To operate, secure, and improve the service, including preventing
            spam, abuse, and fraudulent claims — for example, we limit how many
            open claims one account can hold at a time.
          </li>
          <li>
            To measure aggregate usage and performance so we can improve pages
            and pricing coverage.
          </li>
          <li>To comply with law and to enforce our Terms of Service.</li>
        </LegalList>
      </LegalSection>

      <LegalSection
        id="sharing"
        heading="4. Who we share your information with"
      >
        <div className="rounded-2xl border border-border-default bg-bg-elevated p-5">
          <p>
            <strong className="text-text-primary">
              Read this before you claim a deal.
            </strong>{' '}
            When you claim a deal, we show you the provider&apos;s name,
            address, phone number and website, so you can call or book with them
            directly. Our team then passes your request on to that provider:
            your name, email address, phone number, the deal you claimed, your
            preferred date and time, and any note you wrote. We do this by hand,
            by phone, by email, through the provider&apos;s website form, or by
            messaging its social media account. When we use a website form or a
            social media account, your details also pass through that
            website&apos;s or platform&apos;s systems. The provider may then
            contact you.
          </p>
          <p className="mt-4">
            If the provider holds a CostFinders business account, it also sees
            your claim and your contact details in its dashboard, and the two of
            you can message each other there.
          </p>
          <p className="mt-4">
            Once a provider receives your details, it holds them as an
            independent business under its own privacy practices. We cannot
            retrieve, control, or delete information already in a
            provider&apos;s possession. If you want a provider to delete your
            information, you must contact that provider directly.
          </p>
          <p className="mt-4">
            <strong className="text-text-primary">
              No business pays CostFinders today.
            </strong>{' '}
            CostFinders may be compensated by businesses for referrals in the
            future. If that starts, passing your details to a provider could
            count as a &quot;sale&quot; of personal information under California
            law. See{' '}
            <Link href="#california" className={LINK}>
              your California rights
            </Link>{' '}
            below.
          </p>
        </div>

        <p>We also share information with:</p>
        <LegalList>
          <li>
            <strong className="text-text-primary">Service providers</strong>{' '}
            that run the platform on our behalf — hosting and analytics, our
            database and authentication provider, and our email delivery
            provider. They may use the data only to provide services to us.
          </li>
          <li>
            <strong className="text-text-primary">
              Legal and safety recipients
            </strong>{' '}
            — where we are required to comply with law, respond to lawful
            requests, or protect the rights, safety, or property of users,
            businesses, or CostFinders.
          </li>
          <li>
            <strong className="text-text-primary">A successor entity</strong> in
            connection with a merger, acquisition, financing, or sale of assets.
            We will notify you if your information becomes subject to a
            materially different privacy policy.
          </li>
        </LegalList>

        <p>
          We do not sell or share your information with unrelated advertisers or
          data brokers, and we do not publish your personal information on the
          public pages of the site.
        </p>
      </LegalSection>

      {/* Counsel to confirm: this section answers Washington's My Health My Data Act and
          similar state laws. Nobody has reviewed it against them yet. */}
      <LegalSection id="health-data" heading="5. Consumer health data">
        <p>
          A claim shows that you are interested in a cosmetic treatment, such as
          a neurotoxin injection or a dermal filler. Some state laws treat that
          as consumer health data, so we handle it this way:
        </p>
        <LegalList>
          <li>We collect it only when you submit a claim.</li>
          <li>
            We use it only to show you the provider&apos;s details, to pass your
            request on to that provider, and to keep a record of the claim. We
            never use it for advertising.
          </li>
          <li>
            We share it only with the provider you chose and with the service
            providers named in section 4.
          </li>
          <li>
            We keep it until you delete your account, and for no longer than{' '}
            <Fact value={COMPANY_FACTS.claimRetention} /> after the claim
            closes.
          </li>
          <li>
            You can cancel an open claim from your claims page, and deleting
            your account deletes every claim you made.
          </li>
        </LegalList>
      </LegalSection>

      <LegalSection id="cookies" heading="6. Cookies and analytics">
        <p>
          We use a small number of cookies and similar technologies. Essential
          cookies keep you signed in and secure your session; the site does not
          work without them.
        </p>
        <p>
          For measurement we use{' '}
          <strong className="text-text-primary">Vercel Web Analytics</strong>{' '}
          and{' '}
          <strong className="text-text-primary">Vercel Speed Insights</strong>.
          Vercel Web Analytics is designed to be privacy-friendly: it does not
          use cross-site tracking cookies and does not build a persistent
          cross-site profile of you. Speed Insights measures real-user page
          performance. Both collect page URL, referrer, device and browser type,
          and coarse country-level location.
        </p>
        <p>
          We do not currently run third-party advertising pixels or
          cross-context behavioral advertising trackers. If that changes, we
          will update this policy and provide any opt-out the law requires
          before turning them on.
        </p>
        <p>
          Most browsers let you block or delete cookies in their settings.
          Blocking essential cookies will prevent you from signing in. We do not
          currently respond to browser Do Not Track signals.
        </p>
      </LegalSection>

      <LegalSection id="communications" heading="7. Email">
        <p>
          We send email about your account and your claims: claim confirmations,
          word that we passed your request on, sign-in links, and account and
          security notices. We do not send marketing email or deal alerts, and
          we do not send text messages.
        </p>
        <p>
          The email notifications setting in your account, and the unsubscribe
          link in every email, turn off everything except claim confirmations
          and sign-in or security email. A claim confirmation still goes out,
          because it carries the provider&apos;s contact details you claimed.
        </p>
        <p>
          Messages a provider sends you after we pass your request on come from
          that provider, not from CostFinders. Opting out with us does not opt
          you out with them.
        </p>
      </LegalSection>

      <LegalSection id="retention" heading="8. How long we keep information">
        <LegalList>
          <li>
            <strong className="text-text-primary">
              Account and profile data
            </strong>{' '}
            — kept while your account is open. Delete my account in Settings
            removes your login, profile, claims, messages and saved deals
            straight away. Copies in backups are gone within{' '}
            <Fact value={COMPANY_FACTS.deletedAccountRetention} />.
          </li>
          <li>
            <strong className="text-text-primary">Claims and messages</strong> —
            kept while your account is open, for no longer than{' '}
            <Fact value={COMPANY_FACTS.claimRetention} /> after the claim
            closes, so we can answer questions about a claim.
          </li>
          <li>
            <strong className="text-text-primary">Analytics data</strong> —
            retained in aggregated form by our analytics provider under its own
            retention schedule.
          </li>
          <li>
            <strong className="text-text-primary">
              Legal, tax, and security records
            </strong>{' '}
            — retained as long as required by applicable law, and to enforce our
            agreements.
          </li>
        </LegalList>
        <p>
          Information already passed to a provider is retained by that provider
          under its own schedule, which we do not control.
        </p>
      </LegalSection>

      <LegalSection id="rights" heading="9. Your choices and rights">
        <LegalList>
          <li>
            <strong className="text-text-primary">Access and correct</strong> —
            view and edit your name, phone number, location, and email setting
            at any time in your account settings.
          </li>
          <li>
            <strong className="text-text-primary">Delete</strong> — Delete my
            account in Settings removes your login, profile, claims, messages
            and saved deals. It cannot reach information we already passed to a
            provider.
          </li>
          <li>
            <strong className="text-text-primary">Turn off email</strong> — use
            the email setting in your account or the unsubscribe link in any
            email.
          </li>
          <li>
            <strong className="text-text-primary">Withdraw a claim</strong> —
            cancel an open claim from your claims page. This stops us passing it
            on, but does not recall details already passed on.
          </li>
          <li>
            <strong className="text-text-primary">Portability</strong> —
            download a copy of the personal information you gave us from your
            account settings.
          </li>
        </LegalList>
        <p>
          To exercise any other right, email <ContactEmail />. We will verify
          your identity — usually by confirming control of the email address on
          the account — before acting on a request, and we will respond within
          the time the applicable law allows. We will not discriminate against
          you for exercising a privacy right.
        </p>
      </LegalSection>

      <LegalSection id="california" heading="10. California privacy rights">
        <p>
          If you are a California resident, the California Consumer Privacy Act
          as amended by the California Privacy Rights Act (CCPA/CPRA) gives you
          the rights below.
        </p>
        <LegalList>
          <li>
            <strong className="text-text-primary">Right to know</strong> —
            request the categories and specific pieces of personal information
            we collected about you, the sources, our business purpose, and the
            categories of third parties we disclosed it to.
          </li>
          <li>
            <strong className="text-text-primary">Right to delete</strong> —
            request deletion of personal information we collected from you,
            subject to legal exceptions.
          </li>
          <li>
            <strong className="text-text-primary">Right to correct</strong> —
            request correction of inaccurate personal information.
          </li>
          <li>
            <strong className="text-text-primary">
              Right to opt out of sale or sharing
            </strong>{' '}
            — direct us not to sell or share your personal information, using
            the <DoNotSellLink /> form.
          </li>
          <li>
            <strong className="text-text-primary">
              Right to limit use of sensitive personal information
            </strong>{' '}
            — we do not collect or use sensitive personal information for
            purposes that trigger this right.
          </li>
          <li>
            <strong className="text-text-primary">
              Right to non-discrimination
            </strong>{' '}
            — we will not deny service, charge a different price, or provide a
            different quality of service because you exercised a right.
          </li>
        </LegalList>

        <div className="rounded-2xl border border-border-default bg-bg-elevated p-5">
          <p>
            <strong className="text-text-primary">
              Sale and sharing — what applies here.
            </strong>{' '}
            No business pays CostFinders today, so passing your details to the
            provider you claimed with is not a sale: we receive nothing for it.
            We do not share personal information for cross-context behavioral
            advertising. CostFinders may be compensated by businesses for
            referrals in the future. If that starts, passing your details on
            could count as a &quot;sale&quot; under the CCPA, and we will update
            this policy before it does.
          </p>
          <p className="mt-4">
            The categories of personal information involved would be identifiers
            (name, email address, phone number) and commercial information (the
            deal claimed and your stated preferences). The recipient would be
            the provider you chose. We do not knowingly sell or share the
            personal information of consumers under 16 years of age.
          </p>
          <p className="mt-4">
            <strong className="text-text-primary">To opt out</strong>, use the{' '}
            <DoNotSellLink /> form, or email{' '}
            <ContactEmail subject="Do Not Sell or Share My Personal Information" />{' '}
            with that subject. We apply the request to the account that uses the
            email address you give us.
          </p>
          <p className="mt-4">
            Opting out means we will not pass your details to a provider, so we
            cannot relay a claim for you. Claiming a deal after opting out is
            treated as an instruction to pass your details to that provider for
            that claim.
          </p>
        </div>

        <p>
          California residents may also use an authorized agent. The agent
          should email us at <ContactEmail /> with your signed permission; we
          may still verify your identity with you directly. California
          &quot;Shine the Light&quot; requests may be sent to the same address.
        </p>
        <p>
          Residents of other states with comprehensive privacy laws may have
          comparable rights to access, correct, delete, and opt out of targeted
          advertising or the sale of personal data. We honor those requests
          through the same contact address.
        </p>
      </LegalSection>

      <LegalSection id="security" heading="11. Security">
        <p>
          We use industry-standard measures to protect your information,
          including encryption in transit, row-level access controls in our
          database, and restricting employee access to what is needed to operate
          the service. No method of transmission or storage is completely
          secure, and we cannot guarantee absolute security. If we become aware
          of a breach affecting your personal information, we will notify you as
          required by law.
        </p>
      </LegalSection>

      <LegalSection id="children" heading="12. Children">
        <p>
          CostFinders is not directed to children. You must be at least 18 years
          old to create an account or claim a deal, because the treatments
          listed on this site are aesthetic medical services. We do not
          knowingly collect personal information from anyone under 18. If you
          believe a minor has given us personal information, email us and we
          will delete it.
        </p>
      </LegalSection>

      <LegalSection id="changes" heading="13. Changes to this policy">
        <p>
          We may update this policy as the service changes or the law requires.
          We will revise the &quot;Last updated&quot; date at the top of the
          page, and for material changes — particularly any change to how we
          share your information with providers — we will give notice by email
          or an in-product notice before the change takes effect.
        </p>
      </LegalSection>

      <LegalSection id="contact" heading="14. Contact us">
        <p>
          Questions, requests, or complaints about this policy can be sent to:
        </p>
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
          <Link href="/terms" className={LINK}>
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalPage>
  )
}
