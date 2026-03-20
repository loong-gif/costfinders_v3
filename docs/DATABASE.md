# CostFinders Database Reference

## Connection

| Field | Value |
|-------|-------|
| **Supabase Project** | costfinder |
| **Project ID** | `kdlpkjzcnbkjcvwsvlwn` |
| **Region** | us-west-1 |
| **Postgres Version** | 17.6 |
| **Dashboard** | https://supabase.com/dashboard/project/kdlpkjzcnbkjcvwsvlwn |

### Environment Variables

Copy `.env.example` to `.env.local` and fill in credentials from the Supabase dashboard:

```
Settings → API → Project URL      → NEXT_PUBLIC_SUPABASE_URL
Settings → API → anon public key  → NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Tables in Use

### `master_business_info` (354 rows)

Business profiles scraped from Google Maps and enriched with social data.

| Column | Type | Description |
|--------|------|-------------|
| `business_id` | bigint (PK) | Auto-increment identity |
| `name` | text | Business name |
| `address` | text | Full street address |
| `city` | text | City name (e.g., "Tucson", "Oklahoma City") |
| `website` | text | Raw website URL |
| `website_clean` | text | Cleaned domain (e.g., "laseraway.com") |
| `review_count` | bigint | Google review count |
| `score` | float8 | Google rating (1.0 - 5.0) |
| `category` | text | Business type (see categories below) |
| `facebook_url` | text | Facebook page URL (nullable) |
| `instagram_url` | text | Instagram profile URL (nullable) |
| `membership` | jsonb | Membership pricing structure (nullable) |
| `embedding` | vector | Semantic embedding for similarity search |
| `process_flag` | text | Last processing date |
| `created_at` | timestamptz | Row creation time |
| `updated_at` | timestamptz | Last update time |

**Business categories (by count):**

| Category | Count |
|----------|-------|
| Medical spa | 139 |
| Beauty salon | 74 |
| Skin care clinic | 28 |
| Plastic surgeon | 16 |
| Plastic surgery clinic | 10 |
| Laser hair removal service | 10 |
| Hair salon | 8 |
| Other (11 more) | 69 |

**Cities (top 10):**

| City | Businesses |
|------|-----------|
| Tucson | 82 |
| Oklahoma City | 54 |
| Irvine | 35 |
| Tustin | 29 |
| Costa Mesa | 26 |
| Boulder | 24 |
| Edmond | 19 |
| Santa Ana | 19 |
| Norman | 11 |
| Laguna Hills | 9 |

---

### `promo_offer_master` (347 rows)

Promotional offers extracted from business websites, social media, and email campaigns.

| Column | Type | Description |
|--------|------|-------------|
| `id` | bigint (PK) | Auto-increment identity |
| `business_id` | bigint (FK) | References `master_business_info.business_id` |
| `channel` | text | Source: "Website", "Instagram", "Facebook" |
| `source_url` | text | URL where offer was found |
| `source_name` | text | Business name from the source |
| `template_type` | text | Offer structure (see types below) |
| `service_category` | text | Treatment category (see below) |
| `service_name` | text | Specific treatment (e.g., "Botox", "Lip Filler") |
| `offer_raw_text` | text | Original offer text as scraped |
| `eligibility` | text | Who can use this offer / conditions |
| `is_package` | text | "TRUE" or "FALSE" |
| `discount_percent` | float8 | Percentage discount (nullable) |
| `discount_amount` | text | Dollar discount amount (nullable) |
| `discount_price` | real | Final/sale price |
| `original_price` | real | Regular price before discount |
| `delivered_unit` | float8 | Number of units included |
| `min_unit` | text | Minimum units required |
| `unit_type` | text | "unit", "syringe", "vial", "package" |
| `service_area` | text | Body area (e.g., "Full Face") |
| `is_membership_required` | text | "TRUE" or "FALSE" |
| `membership_name` | text | Membership tier name (nullable) |
| `membership_price` | text | Membership cost (nullable) |
| `billing_period` | text | "monthly", "annual", etc. (nullable) |
| `minimum_term` | text | Contract length (nullable) |
| `cancellation_policy` | text | Cancellation terms (nullable) |
| `membership_content` | text | Full membership description (nullable) |
| `offer_content` | jsonb | Structured offer data (nullable) |
| `start_date` | date | Offer start (nullable) |
| `end_date` | text | Offer end (nullable) |
| `created_at` | timestamptz | Row creation time |

**Template types:**

| Type | Count | Description |
|------|-------|-------------|
| FIXED_PRICE | 204 | Simple per-unit or per-treatment price |
| DISCOUNT | 50 | Percentage or dollar-off discount |
| BUNDLE | 42 | Multi-unit package deal |
| MEMBERSHIP | 37 | Membership-based pricing |
| COMPLIMENTARY | 14 | Free add-on or bonus treatment |

**Service categories:**

| DB Category | Display Name | Count |
|-------------|-------------|-------|
| Neurotoxins | Botox & Neurotoxins | 127 |
| Fillers & Other Injectables | Fillers | 198 |
| Facials & Lasers Services | Facials & Lasers | 6 |
| Wellness | Wellness | 5 |
| Consultations | Consultations | 3 |
| Others | Other Services | 8 |

**Source channels:** Website (308), Instagram (26), Facebook (13)

---

## Other Tables (Not Used by App)

These tables are part of the data pipeline and should not be queried by the frontend:

- `business_list_staging` / `business_list_production` — raw crawl data
- `social_data_staging` / `social_data_production` — social account crawl data
- `promo_website_staging` / `promo_website_staging_new` — raw website page content
- `promo_email_staging` — raw email content
- `promo_social_staging` — raw social media posts

---

## RLS

Row Level Security is **enabled** on all tables. The anon key provides read access.

---

## Client Setup

```typescript
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```
