/**
 * FAQ content helpers for SEO pages
 * Provides templated FAQ content for category and state pages
 *
 * Every answer here renders as page copy AND is emitted as FAQPage JSON-LD through
 * buildFaqSchema(), so it is read twice: once by a consumer and once by Google. Two rules
 * this file got wrong and must not get wrong again:
 *
 * 1. **CostFinders verifies nothing.** `business_claims` holds 0 rows, `business_profiles` only
 *    the test owner account (2026-09-28), and `adapters.ts` hardcodes every deal's
 *    `businessTier` to 'unclaimed'. Listings are compiled from providers' own public pages and
 *    business listings; the star rating shown beside a provider is republished from Google.
 *    The word "verified" does not belong in any answer until a claim/verification program
 *    exists and the copy is gated on it.
 * 2. **There is no review surface.** `business_reviews` holds 1,252 scraped rows that no route
 *    reads — `grep -rn business_reviews src/` returns nothing — so telling a user to "read
 *    reviews from real patients" here points at a page that does not exist. Answers send users
 *    to the provider's own reviews instead.
 *
 * Numeric savings bands are also gone. On 2026-09-28, 600 of the 938 offers shown carry a
 * discount_percent (median 20%) and only 163 print a regular price to save against (one is
 * printed only where the clinic's own words state it) — so no "20-50% off" style band is
 * substantiable from this corpus.
 * Do not reintroduce one that is not computed from the data being shown.
 */

import { treatmentDo } from '@/lib/utils/treatment-grammar'

export interface FaqItem {
  question: string
  answer: string
}

/**
 * Get FAQ items for a treatment category page
 * @param categoryName - Name of the treatment category (e.g., "Botox")
 * @returns Array of FAQ items specific to this category
 */
export function getCategoryFaqs(categoryName: string): FaqItem[] {
  const lowerName = categoryName.toLowerCase()

  // Agreement from the label, not a fixed "does … a": the buckets are "Neurotoxins", "Fillers",
  // "Wellness", and the old strings read "How much does Fillers" and "during a Other Services
  // treatment".
  return [
    {
      question: `How much ${treatmentDo(categoryName)} ${lowerName} typically cost?`,
      answer: `${categoryName} prices vary by provider, location, and treatment area. On CostFinders you can compare the ${lowerName} prices medspas advertise publicly and see how they differ in your area. Discounts vary widely, so compare the advertised total rather than the percentage off.`,
    },
    {
      question: `How do I find a reputable provider for ${lowerName}?`,
      answer: `Look for board-certified practitioners and licensed medspas. CostFinders compiles its listings from providers' own pages and public business listings, and republishes each provider's Google star rating — it does not vet or verify providers itself, so check credentials and read a provider's own reviews before booking. We recommend consultations with 2-3 providers before deciding.`,
    },
    {
      question: `What should I expect at a ${lowerName} appointment?`,
      answer: `Procedures vary in duration and technique. Most medspa treatments take 15-60 minutes. Your provider will explain the process during your consultation, including preparation, the procedure itself, and aftercare instructions.`,
    },
    {
      question: `Are ${lowerName} results permanent?`,
      answer: `Results from ${lowerName} treatments vary by type. Some treatments offer long-lasting results while others require maintenance sessions. Your provider will discuss expected duration and recommended follow-up during your consultation.`,
    },
  ]
}

/**
 * Get FAQ items for a state page
 * @param stateName - Name of the state (e.g., "California")
 * @param treatments - Labels of the treatments this state's live deals actually cover, most
 *   deals first. Empty drops the question rather than templating an answer: every state used
 *   to say "chemical peels and body contouring" are popular there, with nothing behind it.
 * @returns Array of FAQ items specific to medspas in this state
 */
export function getStateFaqs(
  stateName: string,
  treatments: string[] = [],
): FaqItem[] {
  // No "Are medspa prices regulated" answer: "Medspa pricing is not regulated" is a legal claim
  // nobody checked, published as FAQ markup on every state page.
  const listed =
    treatments.length > 1
      ? `${treatments.slice(0, -1).join(', ')} and ${treatments[treatments.length - 1]}`
      : treatments[0]
  return [
    {
      question: `How do I find a reputable medspa in ${stateName}?`,
      answer: `Look for medspas with licensed practitioners, clear pricing, and reviews you can read yourself. CostFinders lists providers across ${stateName} alongside the prices they advertise publicly, so you can compare on price first and then check each provider's licensing and reviews directly before booking.`,
    },
    ...(listed
      ? [
          {
            question: `Which treatments have deals in ${stateName}?`,
            answer: `The deals listed in ${stateName} right now cover ${listed.toLowerCase()}. Browse a city to see each offer at the price its provider advertises.`,
          },
        ]
      : []),
    {
      question: `How can I save money on medspa treatments in ${stateName}?`,
      answer: `Compare deals on CostFinders to find the best prices across ${stateName}. Many medspas offer introductory discounts, package deals, and seasonal promotions. Signing up for provider newsletters can also give you access to exclusive offers.`,
    },
  ]
}

// SEO Deals Pages FAQ Content

/**
 * Get FAQ items for city deals pages
 * @param cityName - Name of the city (e.g., "Houston")
 * @returns Array of FAQ items specific to medspa deals in this city
 */
export function getCityDealsFaqs(cityName: string): FaqItem[] {
  return [
    {
      question: `What are the best medspa deals in ${cityName}?`,
      answer: `CostFinders lists ${cityName} medspa offers as the providers themselves advertise them. Browse current offers on Botox, fillers, facials, laser treatments and more, and compare each advertised price against what other providers nearby are asking.`,
    },
    {
      question: `How do I find reputable medspas in ${cityName}?`,
      answer: `CostFinders does not vet or verify providers — listings are compiled from providers' public pages and business listings, and the star rating shown is republished from Google. Check that a medspa's practitioners are licensed in your state, read the provider's own reviews, and compare several ${cityName} providers before booking.`,
    },
    {
      question: `Are medspa prices in ${cityName} negotiable?`,
      answer: `Prices can vary between providers, and many medspas in ${cityName} run promotional deals and package discounts. CostFinders helps you compare current offers so you can find the best value without negotiating.`,
    },
    {
      question: `What should I look for when choosing a medspa in ${cityName}?`,
      answer: `Look for licensed practitioners, clean facilities, clear pricing, and reviews you can read yourself. CostFinders shows you what each ${cityName} provider advertises so you can compare on price; licensing, credentials and premises are worth confirming with the provider directly.`,
    },
  ]
}

/**
 * Get FAQ items for treatment+city pages
 * @param treatmentName - Name of the treatment (e.g., "Botox")
 * @param cityName - Name of the city (e.g., "Houston")
 * @returns Array of FAQ items specific to this treatment in this city
 */
export function getTreatmentCityFaqs(
  treatmentName: string,
  cityName: string,
): FaqItem[] {
  const lowerName = treatmentName.toLowerCase()

  return [
    {
      question: `How much ${treatmentDo(treatmentName)} ${lowerName} cost in ${cityName}?`,
      answer: `${treatmentName} prices in ${cityName} vary by provider and treatment area. On CostFinders you can compare the ${lowerName} prices multiple ${cityName} medspas advertise publicly. Discounts vary widely between providers, so compare the advertised total rather than the percentage off.`,
    },
    {
      question: `Where can I get ${treatmentName} in ${cityName}?`,
      answer: `CostFinders lists ${cityName} providers advertising ${lowerName} treatments, with the prices they published themselves. Browse current offers and compare prices to shortlist a provider, then check their credentials and reviews directly.`,
    },
    {
      question: `How do I find the best ${treatmentName} deals in ${cityName}?`,
      // "Filter by price, discount percentage, or rating" described a filter set the app does
      // not have — sortSelector.tsx offers popular / newest / biggest discount / price, and the
      // only filter is a price range. Do not describe a control that is not on the page.
      answer: `Compare the ${lowerName} offers ${cityName} providers are advertising on CostFinders. Sort by price or by the biggest discount, and narrow to a price range, to find offers that match your budget. Many providers run seasonal promotions and package discounts.`,
    },
    {
      question: `What should I ask at a ${lowerName} consultation in ${cityName}?`,
      answer: `Ask about the practitioner's experience, the products used, expected results, and aftercare. Ask for an itemised total: an advertised price routinely excludes consultation fees, the number of units or syringes you personally need, and touch-up visits, so it is a starting point rather than a quote.`,
    },
  ]
}
