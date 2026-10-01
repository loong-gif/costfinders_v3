// Raw data exports

export { businesses } from './businesses'
export {
  businessOwners,
  findBusinessOwnerByEmail,
  findBusinessOwnerById,
} from './businessOwners'
// ./categories and ./treatments are gone. Both fixtures existed only to feed
// /admin/dashboard/content/{categories,treatments}, and those screens are gone:
// treatments invented 15 treatments with invented average prices behind an editor
// whose saves evaporated, and the categories fixture was a second, competing
// six-value vocabulary (Botox/Fillers/Facials/Laser/Body/Skincare) that disagreed
// with both content_categories and the real one in @/lib/data/categories.
export {
  claims,
  consumers,
  getClaimByIdDynamic,
  getClaimsForBusiness,
  updateClaimStatus,
} from './consumers'
export {
  deals,
  getDealById as getDealByIdDynamic,
  getDealsForBusiness,
  toAnonymousDeal,
} from './deals'
// ./leadPricing is gone entirely. It held a simulated credit purchase (a module-level balance
// and a purchaseCredits() that incremented it in the browser tab, behind a Stripe trust mark
// with no processor), a per-tier price list, and eight names this barrel re-exported that
// nothing ever imported. Its one live reader was platformSettings.ts, which now carries the
// credit-package list itself. Its BusinessTier was a second, 'free' | 'paid' definition
// competing with the real one in @/types/business — re-exporting it from here was the only
// thing keeping that ambiguity alive.
export {
  cities,
  getAllActiveCitySlugs,
  getCities,
  getCityBySlug,
  locationAreas,
  slugifyCity,
} from './locations'
export {
  type ConversationSummary,
  getClaimIdsWithMessages,
  getConversationsForBusiness,
  getLastMessageForClaim,
  getMessagesForClaim,
  getUnreadCountForClaim,
  markMessagesAsRead,
  sendMessage,
} from './messages'

// Query utilities
export {
  DEFAULT_CITY,
  type DealFilters,
  // Filtering & Sorting
  filterDeals,
  findNearestCity,
  // Locations
  getActiveCities,
  // Deals
  getActiveDeals,
  getAnonymousDealById,
  getAreasForCity,
  // Businesses
  getBusinessById,
  getBusinessCountForCitySlug,
  getBusinessForDeal,
  getCityById,
  getCityByName,
  getClaimById,
  // Claims
  getClaimsByConsumer,
  getClaimsByStatus,
  // Consumers
  getConsumerById,
  getDealById,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getDealsByCategory,
  getDealsByCity,
  // SEO Page Queries
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  getFeaturedDeals,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getSponsoredDeals,
  type SortOption,
  sortDeals,
} from './utils'

// getAllTreatmentCityCombos used to live here, built from the deleted ./categories
// fixture. The one the app actually calls is in @/lib/data/unified.ts and reads the
// live schema; this copy had no callers.
