// Raw data exports

export { admins } from './admins'
export { businesses } from './businesses'
export { businessOwners, findBusinessOwnerByEmail, findBusinessOwnerById } from './businessOwners'
export {
  claims,
  consumers,
  getClaimsForBusiness,
  updateClaimStatus,
  addBusinessResponse,
  getClaimByIdDynamic,
} from './consumers'
export {
  getMessagesForClaim,
  sendMessage,
  getLastMessageForClaim,
  getUnreadCountForClaim,
  markMessagesAsRead,
  getClaimIdsWithMessages,
  getConversationsForBusiness,
  type ConversationSummary,
} from './messages'
export { deals, toAnonymousDeal, getDealById as getDealByIdDynamic, getDealsForBusiness } from './deals'
export {
  cities,
  locationAreas,
  getCityBySlug,
  getAllActiveCitySlugs,
  slugifyCity,
  getCities,
} from './locations'
export {
  getCategories,
  getCategoryById,
  getCategoryBySlug,
  createCategory,
  updateCategory,
  toggleCategoryStatus,
  deleteCategory,
  getCategoryStats,
  type Category,
} from './categories'
export {
  getTreatments,
  getTreatmentsByCategory,
  getTreatmentById,
  createTreatment,
  updateTreatment,
  toggleTreatmentStatus,
  deleteTreatment,
  getTreatmentStats,
  type Treatment,
} from './treatments'
export {
  getLeadPricing,
  getAllLeadPricing,
  getCreditPackages,
  getCreditPackageById,
  getBusinessCredits,
  getCreditUsageHistory,
  calculateTierSavings,
  purchaseCredits,
  type BusinessTier,
  type TierPricing,
  type CreditPackage,
  type BusinessCredits,
  type CreditUsageHistory,
} from './leadPricing'

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
  getDealsByCategory,
  getDealsByCity,
  getFeaturedDeals,
  getSponsoredDeals,
  type SortOption,
  sortDeals,
  // SEO Page Queries
  getDealsForCitySlug,
  getDealsForTreatmentAndCity,
  getDealCountForCitySlug,
  getDealCountForTreatmentAndCity,
  getMinPriceForCitySlug,
  getMinPriceForTreatmentAndCity,
  getBusinessCountForCitySlug,
} from './utils'

// SEO Static Params Generation
import { getAllActiveCitySlugs } from './locations'
import { getCategories } from './categories'
import type { TreatmentCategory } from '@/types/deal'

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
