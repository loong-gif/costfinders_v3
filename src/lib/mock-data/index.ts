// Raw data exports

export { admins } from './admins'
export { businesses } from './businesses'
export {
  businessOwners,
  findBusinessOwnerByEmail,
  findBusinessOwnerById,
} from './businessOwners'
export {
  type Category,
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  getCategoryStats,
  toggleCategoryStatus,
  updateCategory,
} from './categories'
export {
  addBusinessResponse,
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
export {
  type BusinessCredits,
  type BusinessTier,
  type CreditPackage,
  type CreditUsageHistory,
  calculateTierSavings,
  getAllLeadPricing,
  getBusinessCredits,
  getCreditPackageById,
  getCreditPackages,
  getCreditUsageHistory,
  getLeadPricing,
  purchaseCredits,
  type TierPricing,
} from './leadPricing'
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
export {
  createTreatment,
  deleteTreatment,
  getTreatmentById,
  getTreatmentStats,
  getTreatments,
  getTreatmentsByCategory,
  type Treatment,
  toggleTreatmentStatus,
  updateTreatment,
} from './treatments'

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

import type { TreatmentCategory } from '@/types/deal'
import { getCategories } from './categories'
// SEO Static Params Generation
import { getAllActiveCitySlugs } from './locations'

/**
 * Get all treatment+city combinations for static params generation
 * Used by /deals/[treatment]/[city] pages
 */
export function getAllTreatmentCityCombos(): Array<{
  treatment: TreatmentCategory
  city: string
}> {
  const cities = getAllActiveCitySlugs()
  const categories = getCategories().filter((c) => c.isActive)

  const combos: Array<{ treatment: TreatmentCategory; city: string }> = []

  for (const city of cities) {
    for (const category of categories) {
      combos.push({
        treatment: category.slug,
        city,
      })
    }
  }

  return combos
}
