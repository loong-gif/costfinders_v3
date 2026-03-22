# CostFinders v2 -- Database & Data Layer Optimization Plan

**Date**: 2026-03-21
**Scope**: Supabase (PostgreSQL 17.6) queries, React `cache()` strategy, query parallelization, ISR/revalidation tuning
**Tables**: `master_business_info` (354 rows), `promo_offer_master` (347 rows)
**Project ID**: `kdlpkjzcnbkjcvwsvlwn` (us-west-1)

---

## Table of Contents

1. [Issue Inventory](#1-issue-inventory)
2. [Supabase RPC Functions & Database Views](#2-supabase-rpc-functions--database-views)
3. [Query Optimization: Before/After](#3-query-optimization-beforeafter)
4. [React `cache()` Strategy](#4-react-cache-strategy)
5. [Promise.all() Parallelization](#5-promiseall-parallelization)
6. [Supabase-Specific Optimizations](#6-supabase-specific-optimizations)
7. [ISR/Revalidation Strategy](#7-isrrevalidation-strategy)
8. [Implementation Plan](#8-implementation-plan)

---

## 1. Issue Inventory

Every issue below was confirmed by reading the actual source code. No speculation.

| # | Issue | File:Line | Frequency | Impact |
|---|---|---|---|---|
| D1 | `getOffersWithBusinesses()` lacks `cache()` -- duplicate Supabase queries within same request | `offers.ts:62` | Every city page render (metadata + page both call it through different paths) | **Critical** -- 1-3 redundant full queries per request |
| D2 | `getCityDealCounts()` fetches ALL offers with business joins, groups in JS | `unified.ts:256` | Homepage (most-visited page) | **Critical** -- transfers entire offers+businesses dataset for a simple count |
| D3 | `getOfferCategories()` fetches all `service_category` rows, counts in JS | `offers.ts:120-143` | Homepage, treatments index, `generateStaticParams` | **High** -- 347 rows downloaded to produce 6 counts |
| D4 | Two-query waterfall in city-filtered offers | `offers.ts:71-83` | Every city-scoped page (deals, guides, treatment+city) | **High** -- 100-300ms extra latency per call |
| D5 | `getBusinessCategories()` fetches all business rows, counts in JS | `businesses.ts:65-81` | Wherever business categories are displayed | **Medium** -- 354 rows for 15 counts |
| D6 | `getBusinessCountForCity()` fetches full business objects just to `.length` | `unified.ts:304-307` | City deals pages (metadata + page) | **Medium** -- transfers full objects for a count |
| D7 | `getDealCountForCitySlug()` fetches full deals then returns `.length` | `unified.ts:107-109` | Deals page metadata | **Medium** -- full dataset fetch for a count |
| D8 | `getMinPriceForCitySlug()` fetches full deals then finds min in JS | `unified.ts:138-145` | Deals page metadata | **Medium** -- full dataset for a single scalar |
| D9 | Sequential queries in treatment category page | `treatments/[category]/page.tsx:95-109` | Every category page ISR miss | **Medium** -- 3 queries run sequentially |
| D10 | `getBusinessCities()` fallback fetches all businesses if RPC fails | `businesses.ts:38-63` | Every city slug resolution (if RPC missing) | **Medium** -- depends on RPC existence |
| D11 | Guide pages call `getOffersWithBusinesses` twice (stats + preview) with same params | `guide-stats.ts:21-25, 107-111` | Every guide page ISR miss | **Medium** -- duplicate parallel calls with no dedup |
| D12 | No column-level `select` optimization on many queries | Multiple files | All queries | **Low** -- fetches `*` when only subset needed |

---

## 2. Supabase RPC Functions & Database Views

These server-side constructs eliminate JS-side aggregation and the two-query waterfall.

### 2.1 RPC: `get_offers_with_businesses_by_city`

Replaces the two-query waterfall in `getOffersWithBusinesses()` when filtering by city. Instead of:
1. Query `master_business_info` for business_ids in city
2. Query `promo_offer_master` WHERE business_id IN (...)

Use a single SQL join:

```sql
CREATE OR REPLACE FUNCTION get_offers_with_businesses_by_city(city_name text)
RETURNS TABLE (
  id bigint,
  business_id bigint,
  service_category text,
  service_name text,
  offer_raw_text text,
  template_type text,
  discount_price real,
  original_price real,
  discount_percent float8,
  unit_type text,
  eligibility text,
  start_date date,
  end_date text,
  created_at timestamptz,
  is_package text,
  -- business fields
  biz_business_id bigint,
  biz_name text,
  biz_address text,
  biz_city text,
  biz_score float8,
  biz_review_count bigint,
  biz_category text,
  biz_website_clean text
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    o.id,
    o.business_id,
    o.service_category,
    o.service_name,
    o.offer_raw_text,
    o.template_type,
    o.discount_price,
    o.original_price,
    o.discount_percent,
    o.unit_type,
    o.eligibility,
    o.start_date,
    o.end_date,
    o.created_at,
    o.is_package,
    b.business_id,
    b.name,
    b.address,
    b.city,
    b.score,
    b.review_count,
    b.category,
    b.website_clean
  FROM promo_offer_master o
  JOIN master_business_info b ON o.business_id = b.business_id
  WHERE b.city ILIKE city_name
    AND (o.discount_price > 0 OR o.original_price > 0)
  ORDER BY
    CASE
      WHEN o.discount_price IS NOT NULL AND o.original_price IS NOT NULL
           AND o.discount_price < o.original_price THEN 0
      WHEN o.discount_price IS NOT NULL AND o.discount_price > 0 THEN 1
      ELSE 2
    END;
$$;
```

**Impact**: Eliminates the two-query waterfall (100-300ms savings) and moves the sorting logic to SQL.

### 2.2 RPC: `get_city_deal_counts`

Replaces `getCityDealCounts()` which fetches the entire offers+businesses dataset to count deals per city in JS.

```sql
CREATE OR REPLACE FUNCTION get_city_deal_counts()
RETURNS TABLE (
  city text,
  deal_count bigint,
  provider_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    b.city,
    COUNT(o.id) AS deal_count,
    COUNT(DISTINCT o.business_id) AS provider_count
  FROM promo_offer_master o
  JOIN master_business_info b ON o.business_id = b.business_id
  WHERE (o.discount_price > 0 OR o.original_price > 0)
    AND b.city IS NOT NULL
    AND TRIM(b.city) <> ''
  GROUP BY b.city
  ORDER BY deal_count DESC;
$$;
```

**Impact**: Instead of transferring ~347 offer rows with full business joins (estimated 50-100KB of JSON), the database returns ~20 rows of `{city, count, provider_count}` (~1KB). On the homepage this is the single largest optimization.

### 2.3 RPC: `get_offer_category_counts`

Replaces `getOfferCategories()` which downloads all `service_category` values to count in JS.

```sql
CREATE OR REPLACE FUNCTION get_offer_category_counts()
RETURNS TABLE (
  service_category text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    service_category,
    COUNT(*) AS count
  FROM promo_offer_master
  WHERE (discount_price > 0 OR original_price > 0)
    AND service_category IS NOT NULL
  GROUP BY service_category
  ORDER BY count DESC;
$$;
```

**Impact**: Returns 6 rows instead of 347. Eliminates JS-side Map counting.

### 2.4 RPC: `get_business_count_for_city`

Replaces `getBusinessCountForCity()` which fetches full business objects just to count them.

```sql
CREATE OR REPLACE FUNCTION get_business_count_for_city(city_name text)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)
  FROM master_business_info
  WHERE city ILIKE city_name;
$$;
```

**Impact**: Returns a single integer instead of an array of full business objects.

### 2.5 RPC: `get_deal_stats_for_city`

Replaces three separate functions (`getDealCountForCitySlug`, `getMinPriceForCitySlug`, and `getBusinessCountForCity`) that each fetch full datasets for scalar results. Used in deals page metadata generation.

```sql
CREATE OR REPLACE FUNCTION get_deal_stats_for_city(city_name text)
RETURNS TABLE (
  deal_count bigint,
  min_price real,
  business_count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    (SELECT COUNT(*)
     FROM promo_offer_master o
     JOIN master_business_info b ON o.business_id = b.business_id
     WHERE b.city ILIKE city_name
       AND (o.discount_price > 0 OR o.original_price > 0)
    ) AS deal_count,
    (SELECT MIN(COALESCE(o.discount_price, o.original_price))
     FROM promo_offer_master o
     JOIN master_business_info b ON o.business_id = b.business_id
     WHERE b.city ILIKE city_name
       AND (o.discount_price > 0 OR o.original_price > 0)
       AND COALESCE(o.discount_price, o.original_price) > 0
    ) AS min_price,
    (SELECT COUNT(*)
     FROM master_business_info
     WHERE city ILIKE city_name
    ) AS business_count;
$$;
```

**Impact**: Replaces 3 separate function calls (each fetching full datasets) with 1 RPC call returning 3 scalars. Saves 2 Supabase round-trips in the metadata generation path of `/deals/[city]`.

### 2.6 RPC: `get_business_categories` (for businesses.ts)

Replaces `getBusinessCategories()` JS-side aggregation.

```sql
CREATE OR REPLACE FUNCTION get_business_categories()
RETURNS TABLE (
  category text,
  count bigint
)
LANGUAGE sql
STABLE
AS $$
  SELECT
    category,
    COUNT(*) AS count
  FROM master_business_info
  WHERE category IS NOT NULL
  GROUP BY category
  ORDER BY count DESC;
$$;
```

### 2.7 Database Indexes

Add indexes to support the RPC functions and common query patterns:

```sql
-- City lookups (ILIKE is case-insensitive, needs citext or functional index)
CREATE INDEX IF NOT EXISTS idx_business_city_lower
  ON master_business_info (LOWER(city));

-- Offer pricing filter (used by almost every offer query)
CREATE INDEX IF NOT EXISTS idx_offer_pricing
  ON promo_offer_master (business_id)
  WHERE discount_price > 0 OR original_price > 0;

-- Offer by service_category (used by category pages)
CREATE INDEX IF NOT EXISTS idx_offer_category
  ON promo_offer_master (service_category)
  WHERE discount_price > 0 OR original_price > 0;

-- Offer by business_id (FK lookups)
CREATE INDEX IF NOT EXISTS idx_offer_business_id
  ON promo_offer_master (business_id);
```

**Note**: At 354 and 347 rows, indexes provide marginal query-time improvement. Their main value is in supporting the RPC functions and will matter more as data grows. The `idx_business_city_lower` index is the most impactful because ILIKE on `city` currently requires a sequential scan.

---

## 3. Query Optimization: Before/After

### 3.1 `getOffersWithBusinesses()` -- Add `cache()` + RPC for city filter

**Before** (`src/lib/data/offers.ts:62-118`):
```typescript
export async function getOffersWithBusinesses(
  filters?: OfferFilters,
): Promise<OfferWithBusiness[]> {
  let query = supabase
    .from(TABLE)
    .select(`*, ${BUSINESS_JOIN}`)
    .or('discount_price.gt.0,original_price.gt.0')

  if (filters?.city) {
    // TWO-QUERY WATERFALL
    const { data: cityBusinesses } = await supabase
      .from('master_business_info')
      .select('business_id')
      .ilike('city', filters.city)

    if (!cityBusinesses || cityBusinesses.length === 0) return []
    query = query.in(
      'business_id',
      cityBusinesses.map((b) => b.business_id),
    )
  }
  // ... rest of filters and sorting
}
```

**After**:
```typescript
export const getOffersWithBusinesses = cache(
  async function getOffersWithBusinesses(
    filters?: OfferFilters,
  ): Promise<OfferWithBusiness[]> {
    // Fast path: city filter uses single-query RPC
    if (filters?.city && !filters?.serviceCategory && !filters?.minPrice && !filters?.maxPrice) {
      const { data, error } = await supabase.rpc('get_offers_with_businesses_by_city', {
        city_name: filters.city,
      })
      if (error) throw error
      // Transform RPC flat rows into OfferWithBusiness shape
      return (data ?? []).map(mapRpcRowToOfferWithBusiness)
    }

    // City + other filters: still use RPC for city, then filter in Supabase
    if (filters?.city) {
      const { data, error } = await supabase.rpc('get_offers_with_businesses_by_city', {
        city_name: filters.city,
      })
      if (error) throw error
      let results = (data ?? []).map(mapRpcRowToOfferWithBusiness)

      // Apply additional filters in JS (small dataset after city filter)
      if (filters.serviceCategory) {
        results = results.filter((r) => r.service_category === filters.serviceCategory)
      }
      if (filters.minPrice != null) {
        results = results.filter((r) => (r.discount_price ?? 0) >= filters.minPrice!)
      }
      if (filters.maxPrice != null) {
        results = results.filter((r) => (r.discount_price ?? 0) <= filters.maxPrice!)
      }
      if (filters.limit) {
        results = results.slice(0, filters.limit)
      }
      return results
    }

    // No city filter: use PostgREST as before
    let query = supabase
      .from(TABLE)
      .select(`*, ${BUSINESS_JOIN}`)
      .or('discount_price.gt.0,original_price.gt.0')

    if (filters?.serviceCategory) {
      query = query.eq('service_category', filters.serviceCategory)
    }
    if (filters?.minPrice != null) {
      query = query.gte('discount_price', filters.minPrice)
    }
    if (filters?.maxPrice != null) {
      query = query.lte('discount_price', filters.maxPrice)
    }
    if (filters?.limit) {
      query = query.limit(filters.limit)
    }

    const { data, error } = await query
    if (error) throw error

    const results = (data ?? []) as OfferWithBusiness[]
    return results.sort((a, b) => {
      const scoreA =
        a.discount_price && a.original_price && a.discount_price < a.original_price
          ? 0
          : a.discount_price && a.discount_price > 0
            ? 1
            : 2
      const scoreB =
        b.discount_price && b.original_price && b.discount_price < b.original_price
          ? 0
          : b.discount_price && b.discount_price > 0
            ? 1
            : 2
      return scoreA - scoreB
    })
  },
)

// Helper to transform RPC flat row to OfferWithBusiness nested shape
function mapRpcRowToOfferWithBusiness(row: any): OfferWithBusiness {
  return {
    id: row.id,
    business_id: row.business_id,
    service_category: row.service_category,
    service_name: row.service_name,
    offer_raw_text: row.offer_raw_text,
    template_type: row.template_type,
    discount_price: row.discount_price,
    original_price: row.original_price,
    discount_percent: row.discount_percent,
    unit_type: row.unit_type,
    eligibility: row.eligibility,
    start_date: row.start_date,
    end_date: row.end_date,
    created_at: row.created_at,
    is_package: row.is_package,
    master_business_info: {
      business_id: row.biz_business_id,
      name: row.biz_name,
      address: row.biz_address,
      city: row.biz_city,
      score: row.biz_score,
      review_count: row.biz_review_count,
      category: row.biz_category,
      website_clean: row.biz_website_clean,
    },
  } as OfferWithBusiness
}
```

**Key changes**:
1. Wrapped with `cache()` -- deduplicates within a single React render pass
2. City-filtered path uses RPC (single query instead of two)
3. RPC returns pre-sorted results (sorting logic moved to SQL)

**Caveat**: React `cache()` deduplicates by reference equality of arguments. Since `filters` is an object, each call site creates a new object reference. This means `cache()` here primarily helps when the exact same function reference is called multiple times (via higher-level cached wrappers like `getDealsForCitySlug`). For true cross-call dedup, the higher-level `cache()` wrappers on `getDealsForCitySlug` etc. remain essential.

### 3.2 `getCityDealCounts()` -- Replace full-table scan with RPC

**Before** (`src/lib/data/unified.ts:256-283`):
```typescript
export const getCityDealCounts = cache(async function getCityDealCounts() {
  const offers = await getOffersWithBusinesses() // <-- fetches ALL 347 offers with joins
  const cityMap = new Map<string, { dealCount: number; providerIds: Set<number> }>()
  for (const offer of offers) {
    // ... group by city in JS
  }
  // ... build result array
})
```

**After**:
```typescript
export const getCityDealCounts = cache(async function getCityDealCounts() {
  const { data, error } = await supabase.rpc('get_city_deal_counts')

  if (error) {
    // Fallback: use the old approach if RPC doesn't exist
    console.warn('get_city_deal_counts RPC failed, using fallback:', error.message)
    const offers = await getOffersWithBusinesses()
    const cityMap = new Map<string, { dealCount: number; providerIds: Set<number> }>()
    for (const offer of offers) {
      const city = offer.master_business_info?.city
      if (!city?.trim()) continue
      const entry = cityMap.get(city) ?? { dealCount: 0, providerIds: new Set() }
      entry.dealCount++
      if (offer.business_id) entry.providerIds.add(offer.business_id)
      cityMap.set(city, entry)
    }
    return Array.from(cityMap.entries())
      .map(([city, data]) => {
        const { state, stateCode } = inferState(city)
        return { city, slug: cityToSlug(city), state, stateCode, dealCount: data.dealCount, providerCount: data.providerIds.size }
      })
      .sort((a, b) => b.dealCount - a.dealCount)
  }

  return (data ?? []).map((row: { city: string; deal_count: number; provider_count: number }) => {
    const { state, stateCode } = inferState(row.city)
    return {
      city: row.city,
      slug: cityToSlug(row.city),
      state,
      stateCode,
      dealCount: Number(row.deal_count),
      providerCount: Number(row.provider_count),
    }
  })
})
```

**Impact**: Data transfer drops from ~50-100KB (347 full offer objects with nested business data) to ~1KB (20 rows of counts). This is the homepage's heaviest query.

### 3.3 `getOfferCategories()` -- Replace full scan with RPC

**Before** (`src/lib/data/offers.ts:120-143`):
```typescript
export const getOfferCategories = cache(async function getOfferCategories() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('service_category')
    .or('discount_price.gt.0,original_price.gt.0')
  // ... count in JS with Map
})
```

**After**:
```typescript
export const getOfferCategories = cache(async function getOfferCategories(): Promise<
  { service_category: string; count: number }[]
> {
  const { data, error } = await supabase.rpc('get_offer_category_counts')

  if (error) {
    // Fallback to original approach
    console.warn('get_offer_category_counts RPC failed, using fallback:', error.message)
    const { data: raw, error: rawError } = await supabase
      .from(TABLE)
      .select('service_category')
      .or('discount_price.gt.0,original_price.gt.0')

    if (rawError) throw rawError

    const counts = new Map<string, number>()
    for (const row of raw ?? []) {
      if (!row.service_category) continue
      counts.set(row.service_category, (counts.get(row.service_category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([service_category, count]) => ({ service_category, count }))
      .sort((a, b) => b.count - a.count)
  }

  return (data ?? []).map((row: { service_category: string; count: number }) => ({
    service_category: row.service_category,
    count: Number(row.count),
  }))
})
```

**Impact**: Returns 6 rows instead of 347. Runs on homepage in parallel with other queries.

### 3.4 Deals page metadata -- Single RPC instead of 3 function calls

**Before** (`src/app/deals/[[...slugs]]/page.tsx:120-131`):
```typescript
case 'city': {
  const dealCount = await getDealCountForCitySlug(route.citySlug)    // fetches all deals, returns .length
  const cityName = route.citySlug.replace(/-/g, ' ')
  const businessCount = await getBusinessCountForCity(cityName)       // fetches all businesses, returns .length
  const minPrice = await getMinPriceForCitySlug(route.citySlug)      // fetches all deals again, finds min
  return generateCityDealsMetadata(route.cityName, route.citySlug, {
    dealCount, businessCount, minPrice: minPrice ?? undefined,
  })
}
```

**After**:
```typescript
case 'city': {
  const { data: stats } = await supabase.rpc('get_deal_stats_for_city', {
    city_name: route.cityName,
  })
  const row = stats?.[0] ?? { deal_count: 0, min_price: null, business_count: 0 }
  return generateCityDealsMetadata(route.cityName, route.citySlug, {
    dealCount: Number(row.deal_count),
    businessCount: Number(row.business_count),
    minPrice: row.min_price ?? undefined,
  })
}
```

**Impact**: 3 function calls (each fetching full datasets) replaced by 1 RPC returning 3 scalars. Eliminates 2 Supabase round-trips and all the data transfer overhead.

Note: This requires creating a thin wrapper function in `unified.ts` (e.g., `getCityDealStats()`) rather than calling `supabase.rpc` directly from the page file, to maintain the data layer abstraction.

### 3.5 `getBusinessCountForCity()` -- SQL count instead of full fetch

**Before** (`src/lib/data/unified.ts:304-307`):
```typescript
export const getBusinessCountForCity = cache(async function getBusinessCountForCity(cityName: string) {
  const businesses = await getBusinesses(cityName)
  return businesses.length
})
```

**After**:
```typescript
export const getBusinessCountForCity = cache(async function getBusinessCountForCity(
  cityName: string,
): Promise<number> {
  const { data, error } = await supabase.rpc('get_business_count_for_city', {
    city_name: cityName,
  })

  if (error) {
    // Fallback
    const businesses = await getBusinesses(cityName)
    return businesses.length
  }

  return Number(data) || 0
})
```

### 3.6 `getBusinessCategories()` -- Add `cache()` + RPC

**Before** (`src/lib/data/businesses.ts:65-81`):
```typescript
export async function getBusinessCategories(): Promise<
  { category: string; count: number }[]
> {
  const { data, error } = await supabase.from(TABLE).select('category')
  // ... count in JS
}
```

**After**:
```typescript
export const getBusinessCategories = cache(async function getBusinessCategories(): Promise<
  { category: string; count: number }[]
> {
  const { data, error } = await supabase.rpc('get_business_categories')

  if (error) {
    // Fallback to original approach
    const { data: raw, error: rawError } = await supabase.from(TABLE).select('category')
    if (rawError) throw rawError
    const counts = new Map<string, number>()
    for (const row of raw ?? []) {
      if (!row.category) continue
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
    }
    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
  }

  return (data ?? []).map((row: { category: string; count: number }) => ({
    category: row.category,
    count: Number(row.count),
  }))
})
```

---

## 4. React `cache()` Strategy

React's `cache()` deduplicates function calls **within a single server render** (same request). It is essential for functions called from both `generateMetadata()` and the page component, since Next.js runs these in the same render pass.

### Current State

| Function | Has `cache()`? | Called Multiple Times Per Request? | Action |
|---|---|---|---|
| `getOffersWithBusinesses()` | **No** | Yes (via `getDealsForCitySlug`, `getCityDealCounts`, `getDealsByCity`, etc.) | **Add `cache()`** |
| `getOffers()` | **No** | Rarely | Add `cache()` (low priority) |
| `getBusinessCategories()` | **No** | Occasionally | **Add `cache()`** |
| `searchBusinesses()` | **No** | Single call per search | Skip (search-specific) |
| `getActiveDeals()` | **No** | Low frequency | Add `cache()` (low priority) |
| `getDealsByCity()` | **No** | Yes (via `getDealsForCitySlug`) | **Add `cache()`** |
| `getDealsByCategory()` | **No** | Low frequency | Add `cache()` |
| `getBusinesses()` | Yes | Yes | Already good |
| `getBusinessById()` | Yes | Yes | Already good |
| `getBusinessCities()` | Yes | Yes | Already good |
| `getOfferById()` | Yes | Yes | Already good |
| `getOfferCategories()` | Yes | Yes | Already good |
| `getOffersByBusiness()` | Yes | Yes | Already good |
| `getFeaturedOffers()` | Yes | No | Already good |
| `getCityNameFromSlug()` | Yes | Yes | Already good |
| `getDealsForCitySlug()` | Yes | Yes (metadata + page) | Already good |
| `getDealsForTreatmentAndCity()` | Yes | Yes (metadata + page) | Already good |
| `getUnifiedCities()` | Yes | Yes | Already good |
| `getCityDealCounts()` | Yes | No (homepage only) | Already good |
| `getBusinessCountForCity()` | Yes | Yes (metadata + page) | Already good |

### Priority Additions

**Must add `cache()`**:

1. **`getOffersWithBusinesses()`** -- The most-called uncached function. Without `cache()`, every downstream caller that builds a different filter object triggers a fresh Supabase query even within the same render.

2. **`getDealsByCity()`** -- Called by `getDealsForCitySlug()` which is cached, but if `getDealsByCity()` is called directly from other paths, it re-executes.

3. **`getBusinessCategories()`** -- No cache wrapper means duplicate calls within the same request.

### `cache()` Limitation to Understand

React `cache()` uses the function's arguments for memoization key. For `getOffersWithBusinesses(filters)`, the `filters` object is compared by identity (reference), not by deep equality. This means:

```typescript
// These create TWO separate cache entries (different object references):
getOffersWithBusinesses({ city: 'Tucson' })
getOffersWithBusinesses({ city: 'Tucson' })
```

To work around this, the higher-level wrappers like `getDealsForCitySlug(citySlug)` are critical -- they take primitive string arguments that cache properly. The `cache()` on `getOffersWithBusinesses` itself primarily helps when the function is called multiple times from the same higher-level cached wrapper.

For the most impactful deduplication, ensure all page-level data access flows through the cached wrapper functions (`getDealsForCitySlug`, `getDealsForTreatmentAndCity`, etc.) rather than calling `getOffersWithBusinesses` directly.

---

## 5. Promise.all() Parallelization

### 5.1 Treatment Category Page (Priority: High)

**File**: `src/app/treatments/[category]/page.tsx:93-109`

**Before** (sequential):
```typescript
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params
  const categories = await getUnifiedCategories()           // Query 1
  const category = categories.find((c) => c.slug === categorySlug)
  if (!category) notFound()

  const deals = await getDealsByDbCategorySlug(categorySlug) // Query 2 (waits for Query 1)
  // ...
  const cities = await getUnifiedCities()                    // Query 3 (waits for Query 2)
}
```

**After** (parallel where possible):
```typescript
export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: categorySlug } = await params

  // Fire all independent queries in parallel
  const [categories, deals, cities] = await Promise.all([
    getUnifiedCategories(),
    getDealsByDbCategorySlug(categorySlug),
    getUnifiedCities(),
  ])

  const category = categories.find((c) => c.slug === categorySlug)
  if (!category) notFound()
  // ... rest of render
}
```

**Impact**: Reduces ISR cache miss latency by 100-300ms (2 sequential round-trips eliminated). Note that `notFound()` is now checked after all queries complete, but since the category check is a local array lookup (no network), and the data is small, the wasted work on the rare "category not found" case is negligible.

### 5.2 Deals Page Metadata (Priority: High)

**File**: `src/app/deals/[[...slugs]]/page.tsx:120-131`

**Before** (sequential in metadata):
```typescript
case 'city': {
  const dealCount = await getDealCountForCitySlug(route.citySlug)
  const cityName = route.citySlug.replace(/-/g, ' ')
  const businessCount = await getBusinessCountForCity(cityName)
  const minPrice = await getMinPriceForCitySlug(route.citySlug)
  // ...
}
```

**After** (parallel -- or better, use the `get_deal_stats_for_city` RPC as shown in Section 3.4):
```typescript
case 'city': {
  const cityName = route.citySlug.replace(/-/g, ' ')
  const [dealCount, businessCount, minPrice] = await Promise.all([
    getDealCountForCitySlug(route.citySlug),
    getBusinessCountForCity(cityName),
    getMinPriceForCitySlug(route.citySlug),
  ])
  // ...
}
```

**Note**: `getDealCountForCitySlug` and `getMinPriceForCitySlug` both call `getDealsForCitySlug` which is `cache()`-wrapped, so the second call is free. But `getBusinessCountForCity` is independent. Running them in `Promise.all` ensures `getBusinessCountForCity` runs concurrently with the deal queries.

**Best approach**: Replace all three with the `get_deal_stats_for_city` RPC (Section 3.4) for a single round-trip.

### 5.3 Treatment-City Metadata (Priority: Medium)

Same pattern in `case 'treatment-city'` block of the deals page metadata:

```typescript
case 'treatment-city': {
  const cityName = route.citySlug.replace(/-/g, ' ')
  const [dealCount, businessCount, minPrice] = await Promise.all([
    getDealCountForTreatmentAndCity(route.treatmentSlug, route.citySlug),
    getBusinessCountForCity(cityName),
    getMinPriceForTreatmentAndCity(route.treatmentSlug, route.citySlug),
  ])
  // ...
}
```

### 5.4 Provider Page Metadata (Priority: Low -- SSG only)

**File**: `src/app/[state]/[city]/provider/[slug]/page.tsx:54-103`

The `generateMetadata` function runs `getUnifiedCities()`, then `getProvidersByCity()`, then `getDealsForBusiness()` sequentially. Since these are dependent (need city to get providers, need provider to get deals), parallelization is limited. However, `getUnifiedCities()` is `cache()`-wrapped and likely already resolved by the page component, so it resolves instantly from cache.

No change recommended -- this is SSG (build-time only), so runtime performance is not impacted.

### 5.5 Guide Stats and Preview (Priority: Medium)

**File**: `src/lib/data/guide-stats.ts`

`getGuidePricingStats()` and `getGuideDealsPreview()` both call `getOffersWithBusinesses()` with the same `{ serviceCategory, city }` filter. The guide page already wraps them in `Promise.all`:

```typescript
const [stats, topDeals] = await Promise.all([
  getGuidePricingStats(treatment, parsed.city),
  getGuideDealsPreview(treatment, parsed.city, 3),
])
```

With `cache()` added to `getOffersWithBusinesses()`, the underlying Supabase query will be deduplicated. No additional change needed beyond adding `cache()` to `getOffersWithBusinesses`.

---

## 6. Supabase-Specific Optimizations

### 6.1 Column Selection (`select` optimization)

Several queries fetch more columns than needed.

| Query | Current | Recommended |
|---|---|---|
| `getOfferById()` | `select('*')` + business join | Keep -- detail page needs all fields |
| `getOffersWithBusinesses()` no-city path | `select('*, ${BUSINESS_JOIN}')` | OK -- needs most fields for `offerToAnonymousDeal` |
| `getBusinesses(city)` | Selects 12 specific columns | Good -- already optimized |
| `getBusinessById(id)` | `select('*')` | Could select specific cols but single-row query, negligible |
| `getBusinessCities()` fallback | `select('city')` | Good -- minimal |
| `searchBusinesses(query)` | Selects 8 columns | Good |

**Verdict**: Column selection is already reasonable. The biggest wins come from the RPC functions (Section 2), not from narrowing select columns on existing queries.

### 6.2 Supabase Client Configuration

**Current** (`src/lib/supabase.ts`):
```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

This creates a module-level singleton. For server-side data fetching of public data, this is acceptable. However, consider enabling `db` schema caching:

```typescript
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  db: {
    schema: 'public',
  },
  auth: {
    persistSession: false,     // No auth needed for public data queries
    autoRefreshToken: false,   // Saves unnecessary token refresh attempts
  },
})
```

Setting `persistSession: false` and `autoRefreshToken: false` on the data-fetching client avoids auth-related overhead. The separate `supabase-server.ts` client (used for server actions) should keep auth features enabled.

### 6.3 Connection Pooling Consideration

At the current scale (354 businesses, 347 offers, ISR with 1hr revalidation), connection pooling is not a concern. Supabase's PgBouncer handles the connection pool automatically. Each ISR revalidation triggers at most 3-5 queries, and the RPC functions reduce that further.

If the application moves to on-demand ISR or significantly more pages, monitor the Supabase dashboard for connection saturation.

### 6.4 Row-Level Security (RLS) Impact

RLS is enabled on all tables. For public read queries using the anon key, RLS policies add a small overhead per query. Since the RPC functions run with the caller's role (anon), they still go through RLS. If RLS policies are simple `SELECT` grants for anon (which they should be for public data), the overhead is negligible.

If profiling reveals RLS as a bottleneck (unlikely at this scale), consider using `SECURITY DEFINER` on the RPC functions with explicit permission checks, but this is premature optimization.

---

## 7. ISR/Revalidation Strategy

### Current Configuration

| Page | `revalidate` | Strategy | Assessment |
|---|---|---|---|
| Homepage `/` | 3600s (1hr) | ISR | **Appropriate** -- deals change infrequently, hourly refresh is fine |
| Deals `/deals/[...]` | 3600s (1hr) | ISR | **Appropriate** |
| Treatments index `/treatments` | 86400s (24hr) | ISR | **Could be longer** -- categories rarely change |
| Treatment category `/treatments/[cat]` | 3600s (1hr) | ISR | **Appropriate** |
| Provider pages `/[state]/[city]/provider/[slug]` | N/A | SSG (`generateStaticParams`) | **Appropriate** -- fully static at build |
| Guides `/guides/[slug]` | 86400s (24hr) | ISR | **Appropriate** -- pricing guides update less frequently |

### Recommendations

1. **No changes to revalidation values**. The current values are reasonable for the data update frequency (deals added/changed a few times per week at most). Shorter revalidation would increase Supabase query load without user-visible benefit.

2. **Consider On-Demand Revalidation (future)**: When the admin deal moderation flow is active, add `revalidatePath()` or `revalidateTag()` calls to the deal management server actions (`src/lib/actions/deal-management.ts`). This would allow deals pages to refresh immediately when an admin approves/rejects/edits a deal, rather than waiting up to 1 hour.

   ```typescript
   // In deal management server action (future enhancement):
   import { revalidatePath } from 'next/cache'

   async function approveDeal(dealId: string) {
     // ... approve deal in DB
     revalidatePath('/deals', 'layout')          // Refresh all deal pages
     revalidatePath('/', 'page')                  // Refresh homepage (featured deals)
     revalidatePath('/treatments', 'layout')      // Refresh treatment pages
   }
   ```

3. **`dynamicParams` for provider pages**: The provider pages use `generateStaticParams` but do not set `dynamicParams = false`. This means if a user visits a provider URL that wasn't pre-generated, Next.js will attempt to render it on-demand. Setting `dynamicParams = false` would return 404 immediately for unknown slugs, avoiding unnecessary Supabase queries.

   ```typescript
   // src/app/[state]/[city]/provider/[slug]/page.tsx
   export const dynamicParams = false
   ```

4. **Tags for granular revalidation (future)**: When moving to on-demand revalidation, use `unstable_cache` with tags instead of `React.cache()` for data functions:

   ```typescript
   import { unstable_cache } from 'next/cache'

   const getCityDealCounts = unstable_cache(
     async () => {
       const { data } = await supabase.rpc('get_city_deal_counts')
       return transformData(data)
     },
     ['city-deal-counts'],           // cache key
     { revalidate: 3600, tags: ['deals'] }  // revalidate + tag
   )
   ```

   Then `revalidateTag('deals')` invalidates all deal-related caches at once. This is a future enhancement -- the current `cache()` + ISR approach is sufficient for now.

---

## 8. Implementation Plan

Ordered by impact and dependency chain.

### Phase 1: Database Layer (RPC Functions + Indexes)

**Effort**: 2-3 hours
**Impact**: Eliminates JS-side aggregation and two-query waterfall
**Risk**: Low -- fallback to original queries if RPC fails
**Dependency**: Must be done first (application code changes depend on RPCs existing)

| Step | Task | Files |
|---|---|---|
| 1a | Create `get_city_deal_counts` RPC in Supabase | Supabase SQL Editor / migration |
| 1b | Create `get_offer_category_counts` RPC | Supabase SQL Editor / migration |
| 1c | Create `get_offers_with_businesses_by_city` RPC | Supabase SQL Editor / migration |
| 1d | Create `get_deal_stats_for_city` RPC | Supabase SQL Editor / migration |
| 1e | Create `get_business_count_for_city` RPC | Supabase SQL Editor / migration |
| 1f | Create `get_business_categories` RPC | Supabase SQL Editor / migration |
| 1g | Add database indexes | Supabase SQL Editor / migration |
| 1h | Test each RPC via Supabase SQL Editor | Supabase dashboard |

**Expected outcome**: All RPCs available and tested. No application changes yet.

### Phase 2: Core Data Layer Optimization

**Effort**: 3-4 hours
**Impact**: Largest per-request savings
**Risk**: Medium -- must preserve return types for all downstream consumers
**Dependency**: Phase 1 (RPCs must exist)

| Step | Task | Files |
|---|---|---|
| 2a | Add `cache()` to `getOffersWithBusinesses()` + integrate `get_offers_with_businesses_by_city` RPC | `src/lib/data/offers.ts` |
| 2b | Update `getCityDealCounts()` to use `get_city_deal_counts` RPC | `src/lib/data/unified.ts` |
| 2c | Update `getOfferCategories()` to use `get_offer_category_counts` RPC | `src/lib/data/offers.ts` |
| 2d | Update `getBusinessCountForCity()` to use `get_business_count_for_city` RPC | `src/lib/data/unified.ts` |
| 2e | Add `cache()` to `getBusinessCategories()` + integrate RPC | `src/lib/data/businesses.ts` |
| 2f | Add `cache()` to `getDealsByCity()` | `src/lib/data/unified.ts` |
| 2g | Create `getCityDealStats()` wrapper using `get_deal_stats_for_city` RPC | `src/lib/data/unified.ts` |
| 2h | Verify all existing return types are preserved | Type checking |
| 2i | Run `npm run build` to verify no type errors | Build verification |

**Expected outcome**: Data layer uses RPCs with graceful fallbacks. All functions properly `cache()`-wrapped.

### Phase 3: Page-Level Parallelization

**Effort**: 1-2 hours
**Impact**: 100-300ms per ISR cache miss on affected pages
**Risk**: Low -- straightforward refactor
**Dependency**: Phase 2 (benefits from cache() being in place)

| Step | Task | Files |
|---|---|---|
| 3a | Parallelize treatment category page queries | `src/app/treatments/[category]/page.tsx` |
| 3b | Replace metadata triple-query with `getCityDealStats()` (or `Promise.all`) | `src/app/deals/[[...slugs]]/page.tsx` |
| 3c | Parallelize treatment-city metadata queries | `src/app/deals/[[...slugs]]/page.tsx` |
| 3d | Add `dynamicParams = false` to provider pages | `src/app/[state]/[city]/provider/[slug]/page.tsx` |

**Expected outcome**: All page-level data fetches parallelized where possible. Metadata generation uses efficient RPCs.

### Phase 4: Client Configuration + Cleanup

**Effort**: 1 hour
**Impact**: Low -- marginal improvements
**Risk**: Low

| Step | Task | Files |
|---|---|---|
| 4a | Configure data-fetching Supabase client with `persistSession: false` | `src/lib/supabase.ts` |
| 4b | Add `cache()` to remaining uncached functions (`getOffers`, `getActiveDeals`, `getDealsByCategory`) | `offers.ts`, `unified.ts` |

### Impact Summary

| Phase | Expected Latency Savings | Data Transfer Savings | Supabase Query Reduction |
|---|---|---|---|
| Phase 1 (RPCs) | Foundation for Phase 2 | Foundation for Phase 2 | Foundation for Phase 2 |
| Phase 2 (Data layer) | 200-500ms per city page, 100-300ms homepage | ~95% reduction on homepage (`getCityDealCounts`), ~98% on category counts | 40-60% fewer queries per request |
| Phase 3 (Parallelization) | 100-300ms per treatment category page, 100-200ms on deals metadata | Minimal | Minimal (same queries, parallel) |
| Phase 4 (Cleanup) | <50ms | Minimal | Marginal |

### Total Estimated Impact

- **Homepage ISR cache miss**: 300-800ms faster (RPC for city deal counts + category counts)
- **City deals page ISR cache miss**: 200-500ms faster (single-query city filter + stats RPC)
- **Treatment category page ISR cache miss**: 100-300ms faster (parallelization)
- **Guide page ISR cache miss**: 100-200ms faster (`cache()` dedup on `getOffersWithBusinesses`)
- **Data transfer per request**: 50-95% reduction on aggregate queries
- **Supabase query count**: 40-60% reduction across all page types

---

## Appendix: Function Call Graph

Visual reference for understanding which page calls which data function.

```
Homepage (/)
├── getFeaturedOffers(6)                    [cached, direct Supabase]
├── getOfferCategories()                    [cached, → RPC get_offer_category_counts]
└── getCityDealCounts()                     [cached, → RPC get_city_deal_counts]

Deals City Page (/deals/[city])
├── generateMetadata
│   ├── resolveRoute → getUnifiedCities()   [cached]
│   ├── getDealCountForCitySlug()           [→ getDealsForCitySlug (cached)]
│   ├── getBusinessCountForCity()           [cached, → RPC get_business_count_for_city]
│   └── getMinPriceForCitySlug()            [→ getDealsForCitySlug (cached, deduped)]
│   ** OR use getCityDealStats()            [→ RPC get_deal_stats_for_city, single call]
└── Page render
    ├── resolveRoute                        [cached, deduped from metadata]
    ├── getDealsForCitySlug()               [cached, → getDealsByCity → getOffersWithBusinesses (cached)]
    ├── getUnifiedCities()                  [cached, deduped from resolveRoute]
    └── getBusinessCountForCity()           [cached, deduped from metadata]

Treatment Category (/treatments/[category])
├── generateMetadata
│   └── getUnifiedCategories()              [→ getOfferCategories (cached)]
└── Page render (PARALLELIZE)
    ├── getUnifiedCategories()              [cached, deduped from metadata]
    ├── getDealsByDbCategorySlug()          [→ getOffersWithBusinesses (cached)]
    └── getUnifiedCities()                  [cached]

Guide Page (/guides/[slug])
├── generateMetadata
│   └── getGuidePricingStats()              [→ getOffersWithBusinesses (cached)]
└── Page render
    ├── getGuidePricingStats()              [deduped via getOffersWithBusinesses cache]
    └── getGuideDealsPreview()              [→ getOffersWithBusinesses (cached, deduped)]
```
