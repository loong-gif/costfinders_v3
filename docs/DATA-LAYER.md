# Data Layer & State Management

> Hybrid data strategy: Supabase for production data, mock fixtures for development, React Context for client state.

---

## 1. Supabase Data Access (`src/lib/data/`)

### Client Setup (`src/lib/supabase.ts`)

```ts
const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

**Required env vars:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### businesses.ts — `master_business_info` table (354 records)

| Function | Params | Returns | Notes |
|----------|--------|---------|-------|
| `getBusinesses(city?)` | Optional city (case-insensitive) | `Business[]` | Sorted by score desc; wrapped with `cache()` |
| `getBusinessById(id)` | `number` | `Business \| null` | Full record; wrapped with `cache()` |
| `getBusinessCities()` | — | `{city, count}[]` | Tries RPC first, falls back to manual aggregation; wrapped with `cache()` |
| `getBusinessCategories()` | — | `{category, count}[]` | RPC `get_business_category_counts` with JS fallback; wrapped with `cache()` |
| `searchBusinesses(query)` | Search string | `Business[]` (max 20) | ilike on name + address |

### offers.ts — `promo_offer_master` table (347 records)

| Function | Params | Returns | Notes |
|----------|--------|---------|-------|
| `getOffers(filters?)` | `OfferFilters` | `Offer[]` | Sorted by created_at desc |
| `getOfferById(id)` | `number` | `OfferWithBusiness \| null` | Joins `master_business_info`; wrapped with `cache()` |
| `getOffersWithBusinesses(filters?)` | `OfferFilters` | `OfferWithBusiness[]` | LEFT JOIN on business_id; no-arg calls cached via `getAllOffersWithBusinesses()` internal helper |
| `getOfferCategories()` | — | `{service_category, count}[]` | RPC `get_offer_category_counts` with JS fallback; wrapped with `cache()` |
| `getOffersByBusiness(businessId)` | `number` | `Offer[]` | All offers for a business; wrapped with `cache()` |
| `getFeaturedOffers(limit?)` | Default 6 | `OfferWithBusiness[]` | Where discount/original price exist, sorted by savings; wrapped with `cache()` |

```ts
interface OfferFilters {
  city?: string
  serviceCategory?: string
  minPrice?: number
  maxPrice?: number
  templateType?: string
  limit?: number
}
```

### categories.ts — Static mapping (no DB queries)

| Function | Purpose |
|----------|---------|
| `getCategoryLabel(dbCategory)` | DB category → display name (e.g., "Neurotoxins" → "Botox & Neurotoxins") |
| `getCategorySlug(dbCategory)` | DB category → URL slug |
| `getDbCategoryFromSlug(slug)` | Reverse: URL slug → DB category name |

---

## 2. Mock Data Fixtures (`src/lib/mock-data/`)

Used for entities not yet migrated to Supabase (consumers, business owners, deals, claims, messages, etc.).

| File | Entity | Records | Notes |
|------|--------|---------|-------|
| `consumers.ts` | Consumer accounts | 6 | Various verification states |
| `businessOwners.ts` | Business owner accounts | 6 | Various claim/verification states |
| `admins.ts` | Admin accounts | 3-4 | super_admin, moderator, support roles |
| `businesses.ts` | Business profiles | 20+ | In-memory CRUD support |
| `deals.ts` | Deal listings | 100+ | Multiple treatment categories |
| `cities.ts` | City data | 6 | Austin, Dallas, Houston, LA, NYC, Miami |
| `locations.ts` | Location areas | 15+ | Neighborhoods within cities |
| `neighborhoods.ts` | Neighborhood data | 24+ | Nested under cities |
| `states.ts` | US states | 4 | CA, TX, NY, FL |
| `categories.ts` | Treatment categories | 6 | With CRUD operations |
| `treatments.ts` | Treatment types | 20+ | With CRUD operations |
| `messages.ts` | Conversations | 5+ | With unread tracking |
| `billing.ts` | Invoice/billing records | Mock | Stripe-ready structure |
| `leadPricing.ts` | Credit packages | 3 tiers | Lead purchase options |
| `sponsorship.ts` | Sponsorship data | Mock | Sponsored placement config |
| `platformSettings.ts` | Platform config | 1 | Global settings |
| `providers.ts` | Provider profiles | 6+ | For SEO provider pages |

### Key utility functions (`utils.ts`)

```ts
// Deal queries
getActiveDeals(): AnonymousDeal[]
getDealsByCategory(category): AnonymousDeal[]
getDealsByCity(cityName): AnonymousDeal[]
getAnonymousDealById(id): AnonymousDeal | undefined

// Location queries
findNearestCity(lat, lng): City          // Haversine formula
getActiveCities(): City[]
getAreasForCity(cityId): LocationArea[]

// Consumer/Claim queries
getClaimsByConsumer(consumerId): Claim[]
getClaimsByStatus(status): Claim[]

// SEO
getAllTreatmentCityCombos(): {treatment, city}[]
getDealsForCitySlug(slug): AnonymousDeal[]
getDealsForTreatmentAndCity(treatment, citySlug): AnonymousDeal[]
```

---

## 3. React Context State (`src/lib/context/`)

Four context providers. All use localStorage persistence.

### authContext.tsx — Consumer Auth

```ts
useAuth(): {
  state: { user, isAuthenticated, isLoading, error }
  signUp(email, password, firstName?, lastName?)
  signIn(email, password)
  signOut()
  updateVerificationStatus(status)
  verifyPhone(phone)
  updateProfile(updates)
  updateAlertPreferences(alertsEmail, alertsSms)
  savedDeals: string[]
  saveDeal(dealId) / unsaveDeal(dealId) / isDealSaved(dealId)
}
```

**Storage key:** `costfinders_auth` (userId), `costfinders_saved_deals`
**Auth mechanism:** Mock — searches consumers array, no password verification

### businessAuthContext.tsx — Business Owner Auth

```ts
useBusinessAuth(): {
  state: { owner, isAuthenticated, isLoading, error }
  signUp / signIn / signOut
  updateVerificationStatus(status)
  updateClaimStatus(status)
  linkBusiness(businessId)
}
```

**Storage key:** `costfinders_business_auth`

### adminAuthContext.tsx — Admin Auth

```ts
useAdminAuth(): {
  state: { admin, isAuthenticated, isLoading, error }
  signIn(email, password)
  signOut()
}
```

**Storage key:** `costfinders_admin_id`
**No signUp** — admin accounts seeded in mock data only.

### locationContext.tsx — Location Selection

```ts
useLocation(): {
  state: { current: { type, city, area, coordinates }, isLoading, error, hasPermission }
  cities: City[]
  getAreasForCity(cityId)
  detectLocation()          // Browser Geolocation API
  selectCity(city)
  selectArea(area | null)
  clearSelection()
}
```

**Storage key:** `costfinders_location`

### claimsContext.tsx — Deal Claims

```ts
useClaims(): {
  state: { claims, isLoading }
  createClaim(dealId, businessId, preferredDate?, preferredTime?, notes?)
  getClaim(claimId)
  getClaimByDealId(dealId)
  getClaimsByStatus(status)
}
```

**Storage key:** `costfinders_claims`
**Expiry:** 7 days from creation

---

## 4. Types (`src/types/`)

### Supabase Types (`supabase.ts`)

| Type | Table | Key Fields |
|------|-------|------------|
| `Business` | `master_business_info` | business_id, name, address, city, score, review_count, category |
| `Offer` | `promo_offer_master` | id, business_id, service_category, discount_price, original_price |
| `OfferWithBusiness` | JOIN | Offer + picked Business fields |

### Mock Data Types

| Type | File | Key Fields |
|------|------|------------|
| `Deal` | `deal.ts` | id, businessId, category (`TreatmentCategory`), originalPrice, dealPrice, moderationStatus |
| `AnonymousDeal` | `deal.ts` | Like Deal but no businessId; adds locationArea, businessRating, businessTier |
| `Consumer` | `consumer.ts` | id, email, verificationStatus, alertsEmail/Sms, favoriteCategories |
| `BusinessOwner` | `businessOwner.ts` | id, email, businessId?, verificationStatus, claimStatus |
| `Admin` | `admin.ts` | id, email, role (`AdminRole`), permissions[] |
| `Claim` | `claim.ts` | id, dealId, consumerId, businessId, status (`ClaimStatus`), expiresAt |
| `City` | `location.ts` | id, name, state, stateCode, latitude, longitude |
| `LocationArea` | `location.ts` | id, cityId, name, latitude, longitude, radiusMiles |
| `TreatmentCategory` | `deal.ts` | `'botox' \| 'fillers' \| 'facials' \| 'laser' \| 'body' \| 'skincare'` |

---

## 5. Custom Hooks (`src/lib/hooks/`)

### useGeolocation.ts

```ts
useGeolocation(options?): {
  coordinates: { latitude, longitude } | null
  accuracy: number | null
  isLoading: boolean
  error: string | null
  isSupported: boolean
  requestLocation(): Promise<GeolocationPosition>
  clearLocation(): void
}
```

Uses browser Geolocation API. Timeout: 10s. Cache: 60s.

---

## 6. SEO Utilities (`src/lib/seo/`)

| File | Exports | Purpose |
|------|---------|---------|
| `schemas.ts` | `buildWebsiteSchema`, `buildOrganizationSchema`, `buildBreadcrumbSchema`, `buildLocalBusinessSchema`, `buildFaqSchema` | JSON-LD structured data |
| `metadata.ts` | `generateCityDealsMetadata`, `generateTreatmentCityMetadata` | Next.js Metadata objects |
| `faq-content.ts` | `getCategoryFaqs`, `getStateFaqs`, `getCityDealsFaqs` | Templated FAQ content |

---

## 7. Route Registry (`src/lib/routes.ts`)

Central route configuration with hierarchy for breadcrumb generation.

```ts
routeConfig: Record<string, { label: string; parent?: string }>
getBreadcrumbs(pathname): { label: string; href: string }[]
```

Handles dynamic routes by removing segments until a static match is found.

---

## Data Flow Summary

```
Homepage (/) ─────── Supabase (real offers/businesses)
SEO pages ─────────── Mock data (deals, locations, providers)
Consumer dashboard ── AuthContext (localStorage) + Mock claims
Business dashboard ── BusinessAuthContext + Mock data
Admin dashboard ───── AdminAuthContext + Mock data
Location detection ── Browser Geolocation → findNearestCity()
```

## Supabase RPC Functions

Server-side SQL aggregation functions that replace downloading full tables for counting.

| RPC | Returns | Replaces |
|-----|---------|----------|
| `get_city_deal_counts()` | `{city, deal_count, provider_count}[]` | JS-side aggregation of all offers + businesses |
| `get_offer_category_counts()` | `{service_category, count}[]` | Downloading all 347 offer rows for counting |
| `get_business_count_for_city(city_name)` | `bigint` (single count) | Fetching full business objects and counting |
| `get_business_category_counts()` | `{category, count}[]` | Downloading all 354 business rows for counting |

**Supporting indexes:**
- `idx_offers_pricing` — covers discount_price/original_price filters
- `idx_offers_business_id` — foreign key join performance
- `idx_business_city` — city-based business lookups
- `idx_offers_service_category` — category filtering

All RPC calls include JS fallback logic: if the RPC doesn't exist or errors, the function downloads raw rows and aggregates client-side.

---

## Performance Patterns

### React `cache()` Deduplication

All three data files (`businesses.ts`, `offers.ts`, `unified.ts`) import `cache` from React and wrap exported functions. Within a single React server request, duplicate calls to the same function with the same arguments are deduplicated automatically.

**Cached functions in `businesses.ts`:** `getBusinesses`, `getBusinessById`, `getBusinessCities`, `getBusinessCategories`

**Cached functions in `offers.ts`:** `getOfferById`, `getAllOffersWithBusinesses` (internal), `getOfferCategories`, `getOffersByBusiness`, `getFeaturedOffers`

**Cached functions in `unified.ts`:** `getCityNameFromSlug`, `getDealsForCitySlug`, `getDealsForTreatmentAndCity`, `getUnifiedCities`, `getCityDealCounts`, `getBusinessCountForCity`

### `Promise.all()` Parallelization

Used in `unified.ts` for operations that need multiple independent Supabase queries:
- `getDealsByCategory()` — fetches offers for multiple DB categories in parallel
- `getDealsForTreatmentAndCity()` — same pattern, scoped to a city
- Treatment category page metadata and deals page metadata run parallel data fetches

### Lazy Auth

`getSession()` check runs before `getUser()` in both `AuthProvider` and `BusinessAuthProvider`. If there's no session, the heavier `getUser()` call is skipped entirely.

---

## Structured Logging

### Logger (`src/lib/logger.ts`)

```ts
import { logger } from '@/lib/logger'

logger.debug(message, context?)  // dev only (NODE_ENV === 'development')
logger.info(message, context?)   // general info
logger.warn(message, context?)   // warnings (e.g. slow actions >1s)
logger.error(message, context?)  // errors with action name + stack trace
```

Outputs JSON to console, captured by Vercel log drains.

### `withAction()` Wrapper

```ts
import { withAction } from '@/lib/logger'

export const myAction = withAction('myAction', async (args) => {
  // automatically logs timing + errors
})
```

Adds automatic duration tracking and error logging with stack traces. Warns on actions exceeding 1 second.

### Coverage

All 18 server action files in `src/lib/actions/` import `logger` and log errors with action name + error message in their catch blocks.

---

## Known Limitations

1. **No real auth** — mock auth skips password verification, uses localStorage (XSS risk)
2. **No Supabase Auth** — production needs httpOnly cookies via Supabase Auth
3. **No real-time** — Supabase client exists but no Realtime subscriptions
4. **Claims expire client-side** — no background job; 7-day expiry calculated in context
5. **Hardcoded category map** — `CATEGORY_MAP` must be updated manually if DB categories change
