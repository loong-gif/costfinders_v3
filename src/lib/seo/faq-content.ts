/**
 * FAQ content helpers for SEO pages
 * Provides templated FAQ content for category and state pages
 */

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

  return [
    {
      question: `How much does ${categoryName} typically cost?`,
      answer: `${categoryName} prices vary by provider, location, and treatment area. On CostFinders, you can compare ${lowerName} deals from verified medspas to find the best prices in your area. Many providers offer introductory discounts of 20-50% off regular pricing.`,
    },
    {
      question: `How do I find reputable ${categoryName} providers?`,
      answer: `Look for board-certified practitioners and licensed medspas. On CostFinders, all listed providers are verified and you can read reviews from real patients. We recommend scheduling consultations with 2-3 providers before making your decision.`,
    },
    {
      question: `What should I expect during a ${categoryName} treatment?`,
      answer: `${categoryName} procedures vary in duration and technique. Most medspa treatments take 15-60 minutes. Your provider will explain the process during your consultation, including preparation, the procedure itself, and aftercare instructions.`,
    },
    {
      question: `Are ${categoryName} results permanent?`,
      answer: `Results from ${lowerName} treatments vary by type. Some treatments offer long-lasting results while others require maintenance sessions. Your provider will discuss expected duration and recommended follow-up during your consultation.`,
    },
  ]
}

/**
 * Get FAQ items for a state page
 * @param stateName - Name of the state (e.g., "California")
 * @returns Array of FAQ items specific to medspas in this state
 */
export function getStateFaqs(stateName: string): FaqItem[] {
  return [
    {
      question: `How do I find a reputable medspa in ${stateName}?`,
      answer: `Look for medspas with licensed practitioners, positive patient reviews, and transparent pricing. CostFinders lists verified providers across ${stateName}, making it easy to compare services and read authentic reviews before booking.`,
    },
    {
      question: `Are medspa prices regulated in ${stateName}?`,
      answer: `Medspa pricing is not regulated, which is why prices can vary significantly between providers. CostFinders helps you compare deals from multiple medspas in ${stateName} to ensure you're getting fair pricing for your treatments.`,
    },
    {
      question: `What treatments are most popular at ${stateName} medspas?`,
      answer: `Popular treatments at ${stateName} medspas include Botox, dermal fillers, laser treatments, chemical peels, and body contouring. Browse our deals to see current offers on these and other aesthetic treatments near you.`,
    },
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
      answer: `CostFinders lists verified medspa deals in ${cityName} with savings up to 50% off regular prices. Browse current offers on Botox, fillers, facials, laser treatments, and more from trusted providers in your area.`,
    },
    {
      question: `How do I find reputable medspas in ${cityName}?`,
      answer: `All providers on CostFinders are verified. Look for medspas with high ratings, transparent pricing, and positive reviews. We recommend comparing multiple ${cityName} providers and scheduling consultations before booking your treatment.`,
    },
    {
      question: `Are medspa prices in ${cityName} negotiable?`,
      answer: `Prices can vary between providers, but most medspas in ${cityName} offer promotional deals and package discounts. CostFinders helps you compare current offers so you can find the best value without negotiating.`,
    },
    {
      question: `What should I look for when choosing a medspa in ${cityName}?`,
      answer: `Look for licensed practitioners, clean facilities, transparent pricing, and positive patient reviews. CostFinders only lists verified ${cityName} providers, making it easier to find reputable medspas offering quality treatments.`,
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
      question: `How much does ${treatmentName} cost in ${cityName}?`,
      answer: `${treatmentName} prices in ${cityName} vary by provider and treatment area. On CostFinders, you can compare ${lowerName} deals from multiple ${cityName} medspas to find the best price. Many providers offer discounts of 20-40% off regular pricing.`,
    },
    {
      question: `Where can I get ${treatmentName} in ${cityName}?`,
      answer: `CostFinders lists verified providers offering ${lowerName} treatments throughout ${cityName}. Browse current deals, compare prices, and read reviews to find the right provider for your needs.`,
    },
    {
      question: `How do I find the best ${treatmentName} deals in ${cityName}?`,
      answer: `Compare ${lowerName} offers from verified ${cityName} providers on CostFinders. Filter by price, discount percentage, or rating to find deals that match your budget. Many providers offer seasonal promotions and package discounts.`,
    },
    {
      question: `What should I ask during a ${treatmentName} consultation in ${cityName}?`,
      answer: `Ask about the practitioner's experience, the products used, expected results, and aftercare. Inquire about pricing, including any additional fees. CostFinders ${cityName} providers offer transparent pricing so you know what to expect.`,
    },
  ]
}
