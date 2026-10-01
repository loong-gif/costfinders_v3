# CostFinders Messaging Style Guide

> **The definitive guide for all copy, messaging, and UX writing across the CostFinders platform.**

This guide ensures consistent voice, tone, and messaging patterns across consumer, business, and admin experiences.

---

## Table of Contents

- [1. Introduction](#1-introduction)
- [2. Voice & Tone](#2-voice--tone)
- [3. Writing Standards](#3-writing-standards)
- [4. UI Copy Patterns](#4-ui-copy-patterns)
- [5. Form Copy](#5-form-copy)
- [6. Notification Copy](#6-notification-copy)
- [7. Quick Reference](#7-quick-reference)

---

## 1. Introduction

### Purpose

This guide provides a single source of truth for all messaging patterns, voice/tone guidelines, and copy standards across CostFinders. Use it to:

- Write consistent, on-brand copy for new features
- Reference established patterns for common UI elements
- Ensure accessibility and clarity in all user communications

### How to Use This Guide

| Need | Section |
|------|---------|
| Quick pattern lookup | [7. Quick Reference](#7-quick-reference) |
| Error message copy | [4.1 Error Messages](#41-error-messages) |
| Form field labels | [5. Form Copy](#5-form-copy) |
| Email templates | [6. Notification Copy](#6-notification-copy) |
| Voice/tone guidance | [2. Voice & Tone](#2-voice--tone) |

### When to Deviate

Deviate from this guide when:
- Legal/compliance requirements mandate specific language
- Accessibility needs require alternative phrasing
- A/B testing explores messaging variations (document deviations)

Always document deviations and their rationale.

### Related Documentation

- [Visual Style Guide](./style-guide.md) — Colors, typography, spacing
- [Component Library](../src/components/) — UI implementation

---

## 2. Voice & Tone

### 2.1 Core Voice Traits

CostFinders speaks with five consistent traits:

| Trait | Definition | Example |
|-------|------------|---------|
| **Trustworthy** | Honest, transparent, reliable | "These are the prices providers advertise publicly" not "Prices verified by businesses" |
| **Helpful** | Proactive guidance, anticipates needs | "Need help choosing?" not "Figure it out" |
| **Clear** | Simple language, no jargon | "Save 40%" not "Realize significant cost efficiencies" |
| **Confident** | Assured without arrogance | "Find your perfect treatment" not "Maybe you'll find something" |
| **Approachable** | Warm, welcoming, human | "Welcome back!" not "User authenticated" |

### 2.2 Voice Do's and Don'ts

| Do | Don't |
|----|-------|
| Use active voice | Use passive voice |
| Be specific with numbers | Use vague qualifiers |
| Address users directly ("you") | Use third person ("the user") |
| Keep sentences short | Write long, complex sentences |
| Use positive framing | Focus on limitations |

**Keywords to use:** Save, Discover, Compare, Find, Listed, Advertised, Easy, Simple, Free, Near you

**Words to avoid:** Cheap, Spam, Hassle, Complicated, Obviously, Just, Simply (when patronizing) — and every word in 2.2.1 below.

### 2.2.1 What CostFinders Can Honestly Claim About Provenance

Read this before writing any sentence about where a price or a provider came from.

Every listing on this site was **compiled from public sources** — the provider's own website
and booking pages, and public business listings. No provider submitted it, agreed to it, or
was contacted about it. Business accounts are not open: one test owner account exists, and
no provider has ever been checked by us. Star ratings and review counts come
from Google (`master_business_info` keys on `google_place_id`); the site renders no review
content of its own.

| Never write | Because | Write instead |
|-------------|---------|---------------|
| Verified, Vetted, Trusted, Approved, Screened | Nothing on this site verifies a provider or a price | Listed, Advertised, Publicly listed |
| Exclusive, Only on CostFinders | The offers are scraped from pages anyone can read | Listed here |
| "4.8 rating" unattributed | It is Google's number, not ours | "4.8 Google rating" |
| "Save up to N%", "Save N-M%" | A percentage hardcoded into a template is false on most pages the moment the data moves | A figure derived per page from the deals that page actually lists — or no figure at all |
| "Book today", "Book now" | There is no booking flow anywhere in the product | Compare prices, See the listing |
| "Prices refreshed daily", "Updated hourly" | Nothing guarantees an ingest cadence | "as listed when this page was last built" |
| "The business will contact you", any response time | No clinic is told automatically. Our team passes each claim on by hand, and no clinic has promised to reply | "Call or book with the clinic directly" |
| "Your information is never shared" | A claim shares it with the provider; that is what a claim is | "When you claim, we share your name and contact details with this provider." |
| "Qualified leads", "ready-to-book clients" | Nothing qualifies a lead or knows whether someone will book | "See when someone claims one of your deals" |
| "Deal alerts", "text us", "reply STOP" | No deal alert, marketing email or SMS is sent | Leave the feature out until it exists |

**The rule behind the table:** a number in copy must be derivable, at render time, from data the
page itself is showing. If you cannot point at the query that produces it, delete the sentence
rather than soften it. Every entry above is a real defect that shipped and had to be removed.

### 2.2.2 What a claim does (canonical wording)

A claim shows the customer the provider's name, address, phone number and website. Our team
then passes the customer's name, contact details and preferred time to the provider by hand
(phone, email, the provider's website form or its social accounts). The provider may then
contact the customer. Nothing else happens automatically. Copy about a claim says exactly this:

| Where | Wording |
|-------|---------|
| At the claim step | "When you claim, we share your name and contact details with this provider." |
| After the claim | "Call or book with the clinic directly. Mention the CostFinders price when you book. Our team also passes your request on to the clinic." |
| Privacy Policy | "Our team then passes your request on to that provider … The provider may then contact you." |
| Money | "No business pays CostFinders today. CostFinders may be compensated by businesses for referrals in the future." |

### 2.3 Tone by Module

Tone adapts while voice remains constant:

#### Consumer Module
- **Tone:** Warm, encouraging, trust-building
- **Goal:** Help users feel confident discovering and saving
- **Example:** "Here are the prices providers near you advertise for this treatment."

#### Business Module
- **Tone:** Professional, efficient, respectful
- **Goal:** Help businesses grow without feeling sold to
- **Example:** "We've updated your listing. Here's what it shows now."

#### Admin Module
- **Tone:** Clear, factual, action-oriented
- **Goal:** Enable quick decisions with necessary context
- **Example:** "3 listings flagged for review. 2 high priority."

### 2.4 Tone Spectrum

Adjust tone based on context:

```
Serious ←————————————————————————————→ Celebratory
   │                                        │
   ├─ Error states                          ├─ First claim
   ├─ Payment issues                        ├─ Milestone reached
   ├─ Account problems                      ├─ Deal saved
   └─ Security alerts                       └─ Signup complete
```

| Context | Tone Level | Example |
|---------|------------|---------|
| Payment failed | Serious | "Payment couldn't be processed. Please check your card details." |
| Form error | Neutral | "Please enter a valid email address." |
| Deal saved | Warm | "Nice! Deal saved to your collection." |
| First lead | Celebratory | "You just got your first lead! Here's what happens next." |

---

## 3. Writing Standards

### 3.1 Capitalization

**Use sentence case for all UI text:**

| Element | Correct | Incorrect |
|---------|---------|-----------|
| Buttons | "Save changes" | "Save Changes" |
| Headers | "Your saved deals" | "Your Saved Deals" |
| Labels | "Email address" | "Email Address" |
| Menu items | "Account settings" | "Account Settings" |
| Tabs | "All deals" | "All Deals" |

**Exceptions (use as-is):**
- Brand names: CostFinders, Botox, Juvederm
- Acronyms: SMS, API, ID
- Proper nouns: Los Angeles, Dr. Smith

### 3.2 Punctuation

| Rule | Example |
|------|---------|
| No periods on buttons | "Save changes" not "Save changes." |
| No periods on labels | "Email address" not "Email address." |
| Periods on full sentences | "Your changes have been saved." |
| No exclamation points in errors | "Please enter a valid email" not "Please enter a valid email!" |
| One exclamation max in success | "Deal saved!" is fine |
| Use ellipsis for loading | "Saving..." |
| Use ampersand in tight spaces | "Terms & conditions" |

### 3.3 Numbers and Formatting

| Type | Format | Example |
|------|--------|---------|
| Currency | Symbol, no decimals for whole | "$150" not "$150.00" |
| Currency (cents) | Include decimals | "$149.99" |
| Percentages | Number + % | "40% off" |
| Phone | (XXX) XXX-XXXX | "(555) 123-4567" |
| Dates | Month D, YYYY | "January 5, 2026" |
| Dates (compact) | M/D/YY | "1/5/26" |
| Time | 12-hour with am/pm | "2:30 pm" |
| Ranges | En dash, no spaces | "9am–5pm" |

### 3.4 Terminology Glossary

| Term | Definition | Usage |
|------|------------|-------|
| **Deal** | A treatment offering with pricing | "Browse deals" |
| **Claim** | Consumer action to get deal details | "Claim this deal" |
| **Lead** | A consumer who claimed a deal | "New lead received" |
| **Business** | Service provider (medspa/clinic) | "Business dashboard" |
| **Treatment** | Service category | "Popular treatments" |
| **Savings** | Price difference from regular | "Your savings: $200" |
| **Cost** | What the consumer pays. The head term for the guide cluster | "Botox cost in Irvine" |
| **Pricing** | How a provider *structures* what it charges — a model, not an amount | "Two pricing structures run side by side" |

**Never use:** Discount (use "savings"), Customer (use "client" for business context), Vendor (use "business")

---

### 3.5 "Cost" vs "Pricing" on SEO Guide Pages

Applies to `/guides/*` and any future page built to rank for what a treatment costs.

**The rule: every surface that ranks says "cost".** Slug, `<title>`, H1, every H2, the
meta description, the keywords array, and FAQ questions.

**Why.** These pages target the cost cluster — `botox cost` (8.1k/mo), `how much does
botox cost` (8.1k), `cost of botox` (3.6k), `botox cost per unit` (2.9k), `average botox
cost`, and the `<treatment> cost <city>` geo form. A full keyword export for that cluster
contains **zero** instances of the word "pricing". Pages targeting `prices`/`pricing` are
a separate, still-unbuilt cluster; keep the two apart rather than splitting one page's
intent across both.

**Accuracy outranks the keyword, always.** A heading that is wrong is worth less than a
heading that says "pricing". Keep the price-family word where it is the true one:

| Keep | Why | Never write |
|------|-----|-------------|
| `pricingModels[].name` → "Charged Per Unit" | Labels a billing **structure**; the amount lives in the sibling `typicalRange` | "Per-Unit Cost" |
| "price list", "price spread", "price parity", "list price" | Fixed collocations naming real objects | "cost list", "cost spread" |
| "pricing structure" | A **cost structure** is a firm's own costs (rent, wages, product) — a different claim | "cost structure" (when you mean charging) |
| "the clinic quotes a price" | A vendor quotes a price; a buyer incurs a cost | "quote such different costs" |
| "price the same plan at two clinics" | "price" as a verb is correct; "cost out" is supplier-side estimating | "cost out the same plan" |

**Verb agreement.** Treatment labels are singular *and* plural, so templated copy must
agree: "how much **does** Botox cost" against "how much **do** dermal fillers cost". Use
`treatmentDo()` / `treatmentCost()` from `src/lib/utils/treatment-grammar.ts` — never
hardcode "does" or "costs".

**Not renamed:** the JSON keys `howPricingWorks`, `whatAffectsPricing` and `pricingModels`
are internal, carry no SEO weight, and are read by the components. Leave them.

**Enforced in:** the header comment on `generateGuideMetadata()`
(`src/lib/seo/metadata.ts`) and the VOCABULARY RULE block atop
`scripts/generate-guides.ts`.

---

## 4. UI Copy Patterns

### 4.1 Error Messages

#### Error Message Anatomy

```
[Headline - what happened]
[Body - why it happened + how to fix]
[Action - clear next step]
```

#### Error Categories

<details>
<summary><strong>Validation Errors</strong></summary>

| Field | Error | Message |
|-------|-------|---------|
| Required | Empty | "{Field} is required" |
| Email | Invalid format | "Please enter a valid email address" |
| Phone | Invalid format | "Please enter a valid phone number" |
| Password | Too short | "Password must be at least 8 characters" |
| URL | Invalid | "Please enter a valid URL" |

</details>

<details>
<summary><strong>Business Logic Errors</strong></summary>

| Scenario | Message |
|----------|---------|
| Deal expired | "This deal has expired" |
| Already claimed | "You've already claimed this deal" |
| Limit reached | "You've reached the maximum claims for today" |
| Not available | "This deal isn't available in your area" |

</details>

<details>
<summary><strong>Network Errors</strong></summary>

| Scenario | Message |
|----------|---------|
| No connection | "You're offline. Check your connection and try again." |
| Timeout | "Taking longer than expected. Please try again." |
| Server error | "Something went wrong. Please try again." |

</details>

<details>
<summary><strong>Authentication Errors</strong></summary>

| Scenario | Message |
|----------|---------|
| Invalid credentials | "Email or password is incorrect" |
| Account locked | "Account temporarily locked. Try again in 15 minutes." |
| Session expired | "Your session has expired. Please sign in again." |

</details>

#### Error Display Patterns

| Type | Use For | Duration |
|------|---------|----------|
| Inline | Field validation | Persistent until fixed |
| Toast | Non-blocking errors | 5 seconds |
| Banner | Page-level warnings | User dismissible |
| Modal | Critical errors | Requires action |

### 4.2 Success Messages

#### Success Message Anatomy

```
[Confirmation - what succeeded]
[Context - what happens next (optional)]
[Action - next step (optional)]
```

#### Success Categories

| Category | Pattern | Example |
|----------|---------|---------|
| Save | "{Item} saved" | "Deal saved to your collection" |
| Create | "{Item} created" | "Your account has been created" |
| Update | "{Item} updated" | "Profile updated" |
| Delete | "{Item} removed" | "Deal removed from saved" |
| Send | "{Item} sent" | "Message sent to business" |
| Submit | "{Item} submitted" | "Request submitted" |

#### Celebration Intensity

| Level | Use For | Example |
|-------|---------|---------|
| None | Routine actions | "Saved" |
| Low | Standard completions | "Changes saved." |
| Medium | Notable achievements | "Deal saved! View your collection." |
| High | Milestones | "Your first lead is in." |
| Celebration | First-time events | "You got your first lead! 🎉" |

### 4.3 Empty States

#### Empty State Anatomy

```
[Icon - contextual visual]
[Headline - "No {items} yet"]
[Description - why empty + value of having items]
[CTA - action to populate]
```

#### Empty State Patterns

| Context | Headline | Description | CTA |
|---------|----------|-------------|-----|
| Saved deals | "No saved deals yet" | "Save deals to compare them later" | "Browse deals" |
| Search results | "No results found" | "Try adjusting your filters" | "Clear filters" |
| Leads | "No leads yet" | "Leads appear when our team passes on a claim for one of your deals" | — |
| Messages | "No messages yet" | "Messages from businesses appear here" | — |
| Notifications | "All caught up" | "You'll see new notifications here" | — |

#### Empty State Icons

| Context | Icon |
|---------|------|
| Search | MagnifyingGlass |
| Deals | Tag |
| Messages | ChatCircle |
| Notifications | Bell |
| Saved items | Heart |
| Leads | Users |

---

## 5. Form Copy

### 5.1 Field Anatomy

```
[Label] - What to enter (sentence case)
[Input] - Where to enter
[Placeholder] - Example or format hint (optional)
[Help text] - Additional guidance (optional)
[Error] - What went wrong (inline)
```

### 5.2 Validation Timing

| Trigger | Use For |
|---------|---------|
| On blur | Default for most fields |
| On change | Real-time feedback (password strength) |
| Debounced (500ms) | Async validation (email uniqueness) |

### 5.3 Common Field Patterns

<details>
<summary><strong>Account Fields</strong></summary>

| Field | Label | Placeholder | Help Text |
|-------|-------|-------------|-----------|
| Email | "Email address" | "you@example.com" | — |
| Password | "Password" | — | "At least 8 characters" |
| Name | "Full name" | "Jane Smith" | — |
| Phone | "Phone number" | "(555) 123-4567" | "Shared with the provider when you claim a deal" |

</details>

<details>
<summary><strong>Location Fields</strong></summary>

| Field | Label | Placeholder | Help Text |
|-------|-------|-------------|-----------|
| ZIP | "ZIP code" | "90210" | "To find deals near you" |
| Address | "Street address" | "123 Main St" | — |
| City | "City" | "Los Angeles" | — |
| State | "State" | "Select state" | — |

</details>

<details>
<summary><strong>Business Fields</strong></summary>

| Field | Label | Placeholder | Help Text |
|-------|-------|-------------|-----------|
| Business name | "Business name" | "Glow Medspa" | "As it appears on CostFinders" |
| Website | "Website" | "https://example.com" | "Optional" |

</details>

### 5.4 Real-Time Feedback

#### Password Strength
```
Weak     → "Add numbers or symbols for a stronger password"
Fair     → "Getting better! Try adding more characters"
Good     → "Good password"
Strong   → "Strong password"
```

#### Character Counters
```
[Description field: 150/500]
[Bio field: 45/160]
```

---

## 6. Notification Copy

### 6.1 Email Templates

#### Email Anatomy

```
Subject: [Action/Value] - [Context]
Preview: [Compelling reason to open]

Body:
- Greeting (personalized)
- Key message (1-2 sentences)
- Context/details
- Clear CTA
- Sign-off
```

#### Subject Line Patterns

| Type | Pattern | Example |
|------|---------|---------|
| Action needed | "[Action]: [Context]" | "Confirm your email address" |
| Alert | "[Item]: [context]" | "New lead: Botox" |
| Confirmation | "[Item] [status] — [context]" | "Your claim has been submitted — Botox" |

<details>
<summary><strong>Consumer Email Templates</strong></summary>

No welcome email is sent today.

**Deal claimed** (`claimConfirmationEmail` in `src/lib/email/templates.ts`)
```
Subject: Your claim has been submitted — {{deal_title}}

Hi {{first_name}},

You claimed {{deal_title}}. Here is the clinic offering it.
{{clinic name, address, phone, website, Get directions}}

The CostFinders price: {{price_label}}

What happens next:
- Call or book with the clinic directly, and mention the CostFinders price.
- Our team also passes your request on to the clinic.
- Your claim and the clinic's details stay on your claims page.

[View your claims →]
```

</details>

<details>
<summary><strong>Business Email Templates</strong></summary>

**New lead** (`newLeadEmail` in `src/lib/email/ownerTemplates.ts`; no contact details in the email)
```
Subject: New lead: {{deal_title}}

A customer claimed {{deal_title}} on CostFinders.
They asked for {{preferred_date}}, {{preferred_time}}.
Open the lead to see their name and contact details.

[Open the lead →]
```

**Business claim approved** (`claimApprovalEmail` in `src/lib/email/templates.ts`)
```
Subject: Your business claim has been approved — {{business_name}}

Your claim for {{business_name}} has been approved.
Your business dashboard shows your listing, lets you edit your deals' wording and prices,
and lists the leads our team passes on to you.

[Go to your dashboard →]
```

</details>

### 6.2 SMS

No text message is sent, and there is no SMS provider or texting consent. Do not write SMS copy
until both exist.

### 6.3 In-App Notifications

#### Toast Notifications
- Duration: 5 seconds
- Max length: 50 characters
- Pattern: "[Action] [outcome]"

| Type | Message |
|------|---------|
| Success | "Deal saved to collection" |
| Error | "Couldn't save. Try again." |
| Info | "Deal expires in 2 days" |

#### Banner Notifications
- Persistent until dismissed
- Include action when applicable

| Type | Message | Action |
|------|---------|--------|
| Warning | "Complete your profile to claim deals" | "Complete profile" |
| Info | "New features available" | "See what's new" |

#### Badge Notifications
- Number only (max "99+")
- Reset on view

---

## 7. Quick Reference

### 7.1 Cheat Sheet

#### Buttons
```
Primary actions:    "Save", "Continue", "Submit"
Secondary actions:  "Cancel", "Back", "Skip"
Destructive:        "Remove", "Delete" (never "Destroy")
```

#### Common Patterns
```
Loading:     "Saving..." / "Loading..."
Empty:       "No {items} yet"
Error:       "{Field} is required" / "Please enter a valid {field}"
Success:     "{Item} saved" / "{Action} complete"
Confirm:     "Are you sure you want to {action}?"
```

#### Capitalization
```
✓ Sentence case:  "Your saved deals"
✗ Title Case:     "Your Saved Deals"
```

### 7.2 Do's and Don'ts

| Do | Don't |
|----|-------|
| "Save changes" | "SAVE CHANGES" |
| "Email is required" | "You must enter an email!" |
| "Deal saved" | "Deal has been successfully saved to your account" |
| "Something went wrong" | "Error 500: Internal server exception" |
| "Try again" | "Retry the operation" |
| "$150" | "$150.00" |
| "40% off" | "40 percent discount" |
| "Botox Cost in Irvine, CA" | "Botox Pricing in Irvine, CA" |
| "How much do dermal fillers cost?" | "How much does dermal fillers cost?" |

### 7.3 Copy Checklist

Before shipping new copy:

- [ ] Uses sentence case (not Title Case)
- [ ] No periods on buttons/labels
- [ ] No exclamation points in errors
- [ ] Follows voice traits (trustworthy, helpful, clear, confident, approachable)
- [ ] Appropriate tone for module (consumer/business/admin)
- [ ] Error messages have clear fix
- [ ] Success messages confirm what happened
- [ ] Empty states have value proposition + CTA
- [ ] Numbers formatted correctly ($, %, dates)
- [ ] Uses approved terminology (deal, claim, lead, business)
- [ ] SEO guide pages: every ranking surface says "cost", not "pricing" (§3.5)

### 7.4 i18n Variables

When writing copy with dynamic content, use this syntax:

```
"Hi {{first_name}}"
"{{count}} deals found"
"Saved to {{collection_name}}"
"{{business_name}} has {{deal_count}} active deals"
```

Common variables:
- `{{first_name}}`, `{{last_name}}`, `{{email}}`
- `{{business_name}}`, `{{deal_title}}`, `{{treatment_name}}`
- `{{count}}`, `{{amount}}`, `{{date}}`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-01-12 | Initial release — compiled from Phase 17-22 guides |
| 1.1 | 2026-09-09 | Removed "Verified" from the Trustworthy voice example and the keyword list, both of which were re-seeding a claim the data cannot support; added 2.2.1 on provenance |
| 1.2 | 2026-09-24 | Added 2.2.2, the canonical claim wording. Replaced templates that promised a callback, a referral reward, verification, SMS, a welcome email and a digest, none of which exist |

---

*For visual design guidance, see [style-guide.md](./style-guide.md).*
