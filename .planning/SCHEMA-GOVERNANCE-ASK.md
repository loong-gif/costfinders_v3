# CostFinders database: data contract with the data team

**Revised 2026-09-30.** This replaces the 21 September version. Every number and row ID below was
measured against the live `costfinder` Supabase project on 2026-09-30. Where this doc and an older
one disagree, this one wins.

**What changed on our side today.** We fixed four of the open items ourselves, as tracked migrations
(`20260930020001`–`020003`): the title-overwriting trigger, business 1720's split discounts, 8 unstated
prices, and the staging-table grants. Part 5 says what's left for you in each, starting with making
sure your pipeline doesn't undo them.

**Read this first.** The website reads the live database directly. There is no staging copy.
- A row you write or activate appears on the public site with no review step.
- Renaming or removing a column, enum value or function the site uses can break pages. The site
  sees the change before anyone on our side does.
- The site never invents a number. If a field is empty, the site leaves the fact off the page. If a
  field holds a guess, the site prints the guess as fact. **When you don't know a value, leave it
  NULL.**

This doc has eight parts:
1. How an offer becomes a deal on the site
2. What to populate, table by table
3. What the site does with your data
4. Where the earlier asks stand
5. What we need you to do now
6. The rules, as a do and don't list
7. Checks to run before you finish a batch
8. What we do on our side

---

## 1. How an offer becomes a deal on the site

Seven tables hold everything the site shows about a deal:

```
master_business_info          the clinic
 ├─ clinic_services           the clinic's menu: each service's name, category and unit
 ├─ clinic_promotions         a campaign, with its dates        ┐ every offer belongs to
 ├─ clinic_memberships        a membership plan, with its fee   ┘ exactly one of these
 └─ promo_offer_master        the offer: its wording, prices and publish switch
      ├─ promo_offer_items    what the price buys: title, quantity, link to a service
      └─ promo_offer_terms    fine print (the site does not read it today)
```

**A deal is visible on the site when all of these hold.** Your own triggers enforce the first four.
If one fails, the trigger deactivates the offer.
1. `promo_offer_master.is_active = true`.
2. The offer points at **exactly one** of `promotion_id` or `membership_plan_id`, and that promotion
   or plan belongs to the same `business_id`.
3. If it's a promotion, the promotion is active and its `campaign_end_date` is empty or not yet past.
4. The offer has at least one row in `promo_offer_items`.
5. At least one of `discount_price`, `regular_price`, `discount_percent` or `discount_amount` is above
   zero. An offer with no price and no discount has nothing to show, so the site skips it.

**When a change shows up.** Listings refresh within about an hour. A newly activated deal gets its
own page (`/deals/{id}`) after our nightly rebuild at 03:55 UTC.

Today: 419 clinics, 1,736 offers, **943 visible**. Of the visible offers, 440 belong to a membership
plan, 111 are packages, 182 are priced per unit and 11 are "from" prices.

---

## 2. What to populate, table by table

"Required" means the deal or the clinic doesn't show properly without it. Columns not listed are
not read by the site. Fill them however suits your pipeline.

### `master_business_info`: the clinic

| Column | What to put | What the site does with it |
|---|---|---|
| `name` | **Required.** The clinic's name as it brands itself. | Shown in city directories. Also used to **remove the clinic's name from offer text** until a shopper claims the deal (see 3.11), so spell it the way the clinic's own pages do. |
| `address` | **Required.** The full street address, ending in `, ST 12345`. | The site reads the **state** from the end of the address. Without a readable state, the city gets no state page and no cost guide, and our gate fails for any such city that has deals. |
| `city` | **Required.** One spelling per city, e.g. always "Newport Beach". | Builds the city pages and their URLs (`/california/newport-beach`). Two spellings of one city make two cities. |
| `website` | The clinic's site. | Shown to a shopper after they claim a deal. Also used to remove the web address from offer text before a claim. |
| `phone`, `phone_source` | E.164 (`+14125551234`). Source is `website_html` or `google_business_profile`. | Phone shown only after a claim. Leave both NULL if unknown. |
| `score`, `review_count` | Google rating (0–5) and review count. | "Google rating" on provider pages. |
| `category` | The clinic's type, e.g. "Medical spa". | Provider page description. |
| `google_place_id` | Google's ID. Must be unique. | Internal use only. |

Not read by the site: `facebook_url`, `instagram_url`, `logo`.

### `clinic_services`: the clinic's menu

| Column | What to put | What the site does with it |
|---|---|---|
| `service_name` | **Required.** The most specific member of `clinic_service_name_enum` ("Botox", not "Neurotoxin", when the menu says Botox). | Sets `service_category` (below). |
| `service_category` | **Generated.** Don't write it. It comes from `clinic_service_category_for_name()`. | Decides the deal's **badge and treatment page** (table in 3.3). |
| `unit_type` | How the clinic sells it: `unit`, `syringe`, `vial`, `session`, `treatment`, `area` or `shot`. **NULL when the source doesn't say.** | Prints a rate as "$X per syringe" and a package as "$X for 2 syringes". NULL is fine: the site then reads the unit from the offer text, or from the category (neurotoxins are per unit). |
| `regular_price` | Only a price the clinic publishes for this service. **NULL otherwise.** | Your trigger `sync_offer_regular_price_from_service` copies it onto single-item offers. The site prints a regular price only when the offer text states it (3.6). |

Not read publicly: `service_area`, `source_url`.

### `clinic_promotions`: a campaign

| Column | What to put | What the site does with it |
|---|---|---|
| `business_id` | **Required.** The clinic. | Your trigger requires the offer's clinic to match. |
| `campaign_end_date` | The last day the offer is valid, **if the clinic states one**. | **The day after this date, the deal disappears.** Also printed as "Valid until …" and sent to Google as the price's expiry. NULL means no end date. |
| `campaign_start_date` | The first day, if stated. | Printed as "Valid from …". It doesn't hide the deal before that date. |
| `is_active` | Whether the campaign is current. | Your trigger deactivates every offer under a promotion you deactivate. The site itself doesn't read this column. |

Not shown: `promotion_title`, `source_url` (withheld so the clinic stays anonymous).

### `clinic_memberships`: a membership plan

| Column | What to put | What the site does with it |
|---|---|---|
| `membership_name` | The plan's name. | **Hidden until a claim.** The site also removes a distinctive plan name ("Club FX") from the offer text before a claim, because it can identify the clinic. Put the name here, and don't rely on the offer text to carry it. |
| `membership_price` | The fee. | Shown on the deal page only, never in listings. |
| `billing_period` | `monthly`, `quarterly`, `annual` or `one_time`. | "$99 a month" on the deal page. Any other value prints "the clinic doesn't say how often". |
| `minimum_commitment_months` | Months, if stated. `0` for none. | Deal page: "Minimum commitment: 6 months" / "None". |

Not read: `benefits`, `source_url`.

### `promo_offer_master`: the offer and its prices

| Column | What to put | What the site does with it |
|---|---|---|
| `business_id` | **Required.** | City, clinic grouping, duplicate detection. |
| `promotion_id` / `membership_plan_id` | **Exactly one** of them. | Dates or plan terms. |
| `offer_raw_text` | **Required. The clinic's own wording, verbatim.** Don't paraphrase, summarise or add a number the clinic didn't write. | **The most important field.** The site checks every price and discount against this text (3.5). It also reads blanket wording (3.3), the brand name (3.9) and "up to", and shows the text under the title. |
| `price_model` | `total`, `per_unit` or `from` (see the price rules below). | Decides how the price is worded (3.4). |
| `discount_price` | The price the shopper pays, **as the text states it**. | The headline price. |
| `regular_price` | The price before the offer, **only if the text states it**. | Strike-through and "Save X%" (3.6). |
| `discount_percent` / `discount_amount` | The discount **as the text states it**. Your trigger `fn_auto_fix_offer_prices` fills both from the two prices when both exist. | "20% off" / "$100 off" when there's no price to lead with. |
| `is_membership_required` | `true` if only members get the price. | "for members" and a Members tag. |
| `is_new_customer_required` | `true` if only new patients qualify. | "New customers only." |
| `is_package` | `true` when one price buys several units, sessions or items. | Your triggers use it. The site doesn't. |
| `is_active` | The **only** publish switch. | See part 1. |

Not read by the site: `conditions`, `offer_fingerprint`. `updated_at` drives the site's "Newest"
sort, so a bulk rewrite that touches every row reshuffles that list.

**The price rules.** Store what the text states, in the shape it states it:

| The text says | `price_model` | `discount_price` | `delivered_units` (on the item) | The site prints |
|---|---|---|---|---|
| "Hydrafacial $149" | `total` | 149 | NULL | $149 |
| "Botox $12/unit" | `per_unit` | 12 | NULL | $12 per unit |
| "Filler $599 per syringe" | `per_unit` | 599 | NULL | $599 per syringe |
| "40 units of Botox for $399" | `total` | 399 | 40 | $399 for 40 units ($9.98 per unit) |
| "$8.99/unit for your first 10 units" | `total` | 89.90 | 10 | $89.90 for 10 units ($8.99 per unit) |
| "Tox starting at $9 per unit" | `from` | 9 | NULL | From $9 per unit |
| "Filler from $550" | `from` | 550 | NULL | From $550 |
| "20% off filler" | `total` | NULL | NULL | 20% off (`discount_percent = 20`) |
| "$100 off 40+ units" | `total` | NULL | NULL | $100 off (`discount_amount = 100`) |

- A quantity of 2 or more always means "the price buys this many", so the price is the **total** for
  that quantity. Your own check requires `unit_price × delivered_units = discount_price`, and the site
  reads it the same way. (This corrects the 21 September doc, which asked for 8087 as a $8.99 rate
  with 10 units. That shape prints "$8.99 for 10 units".)
- **Never compute a price the text doesn't state.** "20% off" with no price stays a discount. Don't
  apply it to a regular price found elsewhere. The site refuses to print a computed price (3.5), so
  the arithmetic only buys a "Confirm when booking" label.

### `promo_offer_items`: what the price buys

| Column | What to put | What the site does with it |
|---|---|---|
| `item_name` | **The deal's title.** Use the clinic's own name for the thing, short and specific: "Lip Filler", "Neck Band Tox", "Botox". **NULL for a blanket offer** (3.3). | The title of the deal is the `item_name` of the lowest `offer_item_id`. If it's NULL, the offer text is the title. If it's a bare service name like "Dermal Filler", the site also prints the offer text under it. |
| `service_id` | The matching `clinic_services` row. **NULL for a blanket or non-treatment offer.** | Links the deal to a category and treatment page. |
| `delivered_units` | The quantity the price buys, **when the text states it**. NULL otherwise. Never `1` as a placeholder. | "$399 for 40 units" (see the price rules). |
| `unit_price` | Leave it to your triggers. | Not read by the site. |

**One item per offer, unless one price genuinely buys several different things** ("50 units of
Jeuveau + 1 syringe of lip filler for $1,499"). With more than one item, the site prints the total
only, never a per-unit figure, and labels the deal "Our math". 60 visible offers have several items
today.

### `promo_offer_terms`

The site doesn't read this table today, so use it as you like. Since 2026-09-30 the website's
roles can only read it. Your pipeline writes it as before, as the service role.

---

## 3. What the site does with your data

This is how the site turns your rows into what a shopper sees. It's here so you can predict the
result of a change before you make it.

### 3.1 Visibility
See part 1. A deal leaves the site the day after its `campaign_end_date`, or when `is_active` goes
false. Nothing else hides a deal. There's no moderation column any more.

### 3.2 Title
- The title is the `item_name` of the lowest `offer_item_id`, or the offer text when that's NULL.
- When the title is just a service or category name ("Botox", "Dermal Filler"), the site prints the
  clinic's own wording underneath.
- The more specific the `item_name`, the better the card reads (see 5.1).

### 3.3 Category: which treatment page a deal appears on
The site reads `service_category` from the first item that links to a service:

| `service_category` | Treatment page | Browse group |
|---|---|---|
| Neurotoxin | Botox & neurotoxins | Neurotoxins |
| Dermal Filler | Fillers | Fillers |
| Facial | Facials | Facials & lasers |
| Microneedling | Skin care | Facials & lasers |
| Regenerative Injectable | Skin care | Facials & lasers |
| Skin Tightening | Skin care | Facials & lasers |
| Laser & Light | Laser | Facials & lasers |
| Laser Hair Removal | Laser | Facials & lasers |
| Wellness | Wellness | Wellness |
| Body Contouring | Body | Body contouring |

**Blanket offers get no category.** A clinic-wide discount isn't a treatment, so it shows on city and
clinic pages with no badge and no treatment page (owner decision, 2026-09-16). The site treats an
offer as blanket in two cases:
- Its text says "any service / treatment / procedure", "all services / treatments / products /
  purchases", "products and services", "site-wide", "entire menu", "every service", "gift card",
  "skin care products" or "off your first treatment / visit / appointment".
- The same clinic has 3 or more rows with the same discount and the same wording, linked to 2 or
  more categories. This is the "one blanket discount split per service" pattern.

An offer whose items don't link to any service also gets no category, with the same result. That's
right for "10% off injectables", which spans neurotoxins and fillers. 18 visible offers are like
this today, and all of them are clinic-wide or multi-category discounts.

A **new `service_category` member** has no treatment page until we map it. The site's build fails
until we do, which is deliberate. Tell us first (6).

### 3.4 How a price is worded
The site picks one of four shapes, in this order:
1. **Quantity**: the item has `delivered_units` of 2 or more, the offer has one item, and the unit is
   known. Prints "$299 for 40 units", plus "$7.48 per unit".
2. **Rate**: `price_model = per_unit`, or `from` with "per unit / per syringe" in the text. Prints
   "$4.25 per unit", "From $9 per unit" or "$765 per vial". With no unit known, it prints "$499 each".
3. **Rate read from the text**: a `total` whose own text states that exact price as a rate ("$10.50
   a unit").
4. **Total**: everything else. Prints "$79".

The unit comes from `unit_type`, then the offer text, then the category (neurotoxins are per unit).
Member-only prices get "for members". "Up to 20% off" keeps the "Up to".

### 3.5 The site only prints prices the clinic states
Before printing a price, the site looks for it in `offer_raw_text`. The check tolerates "$1,499",
"$1499.00" and a missing "$". A quantity price also passes when the text states the rate and the
count ("$8.99/unit … first 10 units" covers $89.90). If the figure isn't there:
- the price is not shown, and the card leads with the discount the text states;
- the deal is labelled **"Confirm when booking"**;
- our 6-hourly price check flags the row.

Owner-entered deals (no items) are exempt, because the clinic typed the price itself.

### 3.6 Regular price and savings
A regular price prints only when the offer text states it. Then the site shows the strike-through,
"Save $X / X%" and the list price it sends to Google. Otherwise none of them appear, and neither
does a percent or amount computed from that regular price.

### 3.7 How sure we are: the label on every deal
| Label | When |
|---|---|
| **As advertised** | Every figure is the clinic's own. |
| **Our math** | We did arithmetic on the clinic's figures: a per-unit price from a package, a bundle total, or "buy 10 get 2 free" as a percent. |
| **Confirm when booking** | Something doesn't add up: a price not in the text, a discount not in the text, a neurotoxin rate outside $2–$30 per unit, or a rate whose unit is unknown. |

A "Confirm when booking" deal is never ranked, never used in a "from $X" and never counted toward a
typical price.

### 3.8 Comparing and ranking
Deals are sorted and filtered by a comparable price:
- **Neurotoxins compare per unit** (owner decision), within $2–$30 a unit.
- **Everything else compares on what you pay.** A per-unit rate on a non-neurotoxin isn't comparable,
  so it sorts after priced deals.

### 3.9 Typical prices and "from $X"
- **"Typical" is neurotoxins only**, per unit, per city. It needs at least 5 priced deals from at
  least 3 clinics. It leaves out Dysport (a Dysport unit is a third the size), "from" prices and
  "Confirm when booking" deals.
- **"From $X"** is the cheapest real price in a group. It never uses a "from" price for neurotoxins.
- **Brand** comes from the title first, then the offer text. It must be exactly one of Botox,
  Dysport, Xeomin, Jeuveau, Daxxify, Letybo or Myobloc. A "Neurotoxin" title with "tox" text has no
  brand, so the deal can't say which toxin the price buys. **Name the brand when the clinic does.**

### 3.10 Memberships
- Listings say "for members" and show a Members tag. The fee, billing period and commitment appear
  only on the deal page.
- The plan's name stays hidden until a claim.
- When a clinic has the same deal under several plans (the same title, price and wording), the site
  shows one card and keeps the plan with the **cheapest fee over a year**.

### 3.11 The clinic stays anonymous until a shopper claims the deal
Before a claim, a deal card shows the **city only**. The site removes the clinic's name, the parts of
the name, its web address and "Dr. <Name>" from the offer text and titles. After a claim the
shopper sees the clinic's name, address, phone, website and rating. That's why `name`, `website`
and `city` must be right: they drive the removal. City directories list clinics only where a city
has at least 4 named clinics.

### 3.12 Cities, states and the sitemap
- The city list is every non-blank `master_business_info.city`. The state comes from the address.
- A city and its state page appear only when the city has at least 1 visible deal.
- Deal pages and city pages are listed for Google. Clinic pages are listed only in cities with at
  least 4 clinics.

### 3.13 Cost guides
A treatment gets a cost guide for a city once that city has at least 10 visible deals for it from
at least 3 clinics. Market figures print only where there are enough priced deals: a typical price
for neurotoxins, or 3 priced deals from 3 clinics otherwise.

---

## 4. Where the earlier asks stand

Most of the 21 September asks are done. Thank you. Status as of 2026-09-30:

| Ask (21 Sep) | Status | Evidence, 2026-09-30 |
|---|---|---|
| 2.1 Move QA backups out of `public` | **Done** | `move_qa_tables_to_private_schema_and_revoke_queue_access` (09-21). No backup tables in `public`, and the guardrail queue has no client grants. |
| 2.2 One row per blanket discount | **Done** | 0 visible blanket offers linked to a service. The last split clinic (1720) was repaired on our side: see 5.2. |
| 2.3 Linking must not overwrite titles | **Stopped; restoring is yours** | The item trigger fills `item_name` only when it's empty (yours). The service trigger now only follows a rename (ours, `020001`). See 5.1. |
| 2.4 Estimates stored as offers | **Done** | 0 visible "(est.)" rows. |
| 2.4 8568 package count | **Done** | 8 units, `is_package = true`. |
| 2.4 Prices the text doesn't state | **Done** | We repaired 8 rows. The other 8 are arithmetic on stated figures and accepted. See 5.3. |
| 2.5 Unknown units stay NULL | **Done** | `repair_clinic_service_unit_type_unknowns` (09-22). 115 services NULL, no `others`, `treatment` down from 133 to 16. Unit mix: unit 497, session 321, syringe 234, vial 35, treatment 16, shot 10, area 2. |
| 2.5 `price_unit` on `promo_offer_items` | **Not done** | See 5.4. |
| 2.6 Tell us before changing the shape | **Done since 09-22** | No schema changes from your side since then. |
| `Skin Tightening` mapping (our side) | **Done** | Maps to Skin care (3.3). |
| Stop badging unlinked offers "Body" (our side) | **Done** | Unlinked and blanket offers get no badge (3.3). |

---

## 5. What we need you to do now

### 5.1 Deal titles: the overwriting is stopped, now restore them (high)

`trg_sync_promo_offer_item_name_from_service` on `clinic_services` (AFTER UPDATE) runs
`sync_promo_offer_item_name_from_service()`. Until today it set `item_name = service_name` on **every**
item linked to the service, whenever **any** column of the service row changed, so a price update
renamed every deal linked to that service.

Today 925 of the 943 visible deals are titled with a bare service name, and on 292 of them the name
doesn't appear in the clinic's own wording:

| Offer | Clinic's wording | Title on the site |
|---|---|---|
| 1451 | "Naked Lips \| Lip Filler $149 (regular $299)" | Dermal Filler |
| 7720 | "Neck Band TOX - $499 (regular $599) …" | Neurotoxin |
| 7791 | "20 free units of tox on your anniversary" | Neurotoxin |

**Fixed on our side, 2026-09-30** (`20260930020001_service_rename_keeps_scraped_titles`). The function
now moves titles only when the service is actually **renamed**, and only titles that still read as
the old service name. A price or unit update no longer touches a title, and a scraped title is never
overwritten. We proved it on a live Botox service in a rolled-back test.

**Do this:**
1. **Keep the new body.** If your pipeline re-creates `sync_promo_offer_item_name_from_service()` from
   its own source, update that source to match, or the old behaviour comes back.
2. **Restore the scraped titles.** The damage from before today stays until you do: 925 of 943 visible
   deals still have a bare service name as their title. Where your source data has the clinic's own
   item name ("Lip Filler", "Neck Band Tox"), write it to `item_name`.

### 5.2 One clinic's split blanket discounts (fixed on our side)

Business 1720 stores each clinic-wide member discount three times, and each copy is titled after a
different filler:

| Plan | Wording | Rows | Their titles |
|---|---|---|---|
| 363 | "10% off all products and services" | 7853, 7856, 10082 | Dermal Filler, Sculptra, Radiesse |
| 515 | "15% off all products and services" | 7958, 10086, 10380 | Sculptra, Radiesse, Dermal Filler |

These are the six former "(est.)" rows. **Fixed on our side, 2026-09-30** (`20260930020003`). We kept 7853
and 7958, deactivated 7856, 10082, 10086 and 10380, and cleared the kept rows' `item_name`, so the
title is now the clinic's wording. **Do this:** make sure your next sync doesn't recreate or reactivate
the four duplicates.

### 5.3 Prices the text doesn't state (fixed on our side)

**Fixed on our side, 2026-09-30** (`20260930020003`), for the 8 rows below. Each now stores what the clinic
states, and each moved from "Confirm when booking" to "As advertised" (10031 to "Our math"). Our price
check's accepted list shrank from 16 rows to 8. **Do this:** make sure your next sync doesn't write the
computed prices back. If it does, our 6-hourly check will flag them.

What each row said, what it stored, and what it stores now:

| Offer | Wording | Stored before | Stores now |
|---|---|---|---|
| 1386 | "Botox Injection 20% off from regular price for first time patient." | $10.40 per unit, regular $13 | `discount_percent = 20`. The $13 isn't in the text. |
| 7758 | "$50 OFF Each Filler Treatment (starts at $550+)" | from $500 | `discount_amount = 50`. $550 is where the treatment price starts, not a price with the discount taken off. |
| 9545 | "$50 OFF Each Syringe of Biostimulator (starts at $900+)" | from $850 | `discount_amount = 50` |
| 9659 | "$50 OFF Each Syringe of Filler (starting at $700)" | from $650 | `discount_amount = 50` |
| 10056 | "$75 OFF Each Filler Treatment (starts at $550+)" | from $475 | `discount_amount = 75` |
| 9216 | "Facial Balancing: 30% off second syringe at $700/syringe" | $490 per syringe | `regular_price = 700`, `discount_percent = 30`. Only the second syringe is discounted. |
| 10031 | "…buy 120 units and receive 30 additional free units — a $135 value." | $540 total, regular $675 | `discount_percent = 20`. The site reads "buy 120, get 30 free" as 20% off and labels it "Our math". |
| 8788 | "Chemical Peels (regularly $350)" | $332.50 (5% off) | `discount_percent = 5`, and the offer text is now the clinic's own benefit wording from membership plan 242: "5% off chemical peels, microneedling and PRF". The "$350" appears in no source we could find, so it's gone. |

**Left as they are, accepted:** 7122, 8277, 8278, 8509, 8800, 9338, 9346 and 10059. These are
arithmetic on figures the text does state (for example "10% OFF SkinVive (regularly $450)" stored as
$405). There's nothing wrong with the numbers. **For new rows**, store `regular_price` and the
discount, and leave `discount_price` NULL. The site shows "10% off, regularly $450" and labels it
"As advertised".

### 5.4 Add `price_unit` to `promo_offer_items` (medium)

A unit belongs to the offer, not to the service. "Brow Lift: $79 per specialty area" is a
neurotoxin, which the menu sells per unit, but this offer is priced per area. Today the site reads
the unit from the offer text with a pattern match. That's fragile.

**Do this:** add `promo_offer_items.price_unit offer_purchase_unit_enum` (the enum already has
`unit, vial, syringe, session, treatment, area, item, other`). Set it whenever the price is a rate
or a quantity. Tell us when it lands, and we'll switch the site to read it first.

### 5.5 Client grants on two staging tables (fixed on our side)

**Fixed on our side, 2026-09-30** (`20260930020002_revoke_staging_client_grants`). `promo_email_staging`
gave `anon` and `authenticated` SELECT, and `promo_social_staging` gave `authenticated` INSERT, UPDATE
and DELETE. RLS was already refusing all of it. Both roles now hold nothing there: an anon read gets
`42501`. Your service-role writes are unaffected. **Do this:** don't re-grant them. Moving the tables
out of `public`, as you did the QA tables, would be better still.

### 5.6 Fill in city and address for 22 clinics (medium: one chain's deals are on no city page)

22 clinics have a blank `city`. The site doesn't work a city out from the address, so these clinics'
deals appear on no city page. Only one has live deals today: **business 3100, "Simplicity Laser"**, with
3 deals and no city or address. It looks like a chain: one website and a toll-free number. So there's
no single city to fill in, and we didn't guess one. **Do this:** decide which location each of its 3
deals belongs to. Store each location as its own clinic row with its own address and city, and point
the deals at it. Then fill in the other 21.

### 5.7 Record when you last saw each offer on the clinic's site (planned)

The trust labels would be stronger with a "last seen on the clinic's site" date: "Checked on the
clinic's site 3 days ago". Please propose a column, for example `promo_offer_master.last_seen_at
timestamptz`, set each time the pipeline finds the offer still live. Send it as a migration file,
and tell us before it lands (6).

---

## 6. The rules

### Do

- **Write every change to schema, enums, functions, triggers, policies or grants as a migration file**
  and send it to us, or commit it to `supabase/migrations/`.
  - The file name must match the name in the ledger. Our drift check matches on name.
  - Data-only repairs don't need a file.
- **Tell us before adding a `service_category` member.** The site has no treatment page for it until
  we map it (3.3).
- **Add `service_name` members freely.** In the same migration, add the branch to
  `clinic_service_category_for_name()`. Without one, the first insert fails, because
  `service_category` is generated and NOT NULL.
- **Add enum values. Don't replace them.** To retire a value, first stop writing it. Remove it later,
  after we confirm the site no longer uses it.
- **Keep `offer_raw_text` verbatim.** Every price check runs against it.
- **Leave unknown values NULL**: `delivered_units`, `unit_type`, `regular_price`, `discount_price`,
  `campaign_end_date`, `phone`.
- **Use `is_active` as the only publish switch.**
- **Keep QA, backup and staging tables out of `public`**, and drop them when you're done.
- **Run the checks in part 7** before you call a batch finished.

### Don't

- **Don't rename or drop a column the site reads.** Everything listed in part 2 is read. If one has
  to change, tell us first, so we can ship the matching change the same day.
- **Don't add a `price_model` or `billing_period` value** without telling us. Both are plain text,
  and an unknown value degrades silently: a price reads as a total, and a fee has no period.
- **Don't touch `public.is_admin()`.** It looks like a redundant wrapper around `private.is_admin()`,
  but the site calls it over the API, which only sees `public`. Moving or dropping it locks every
  admin out, with no error anywhere. This happened on 10 September.
- **Don't change RLS policies or grants on tables the site uses** without telling us. A missing
  policy doesn't raise an error. It returns zero rows, and the page shows a confident empty state.
- **Don't split a blanket or non-treatment offer into per-service rows** (3.3, 5.2).
- **Don't compute a price the text doesn't state**, and don't store estimates as offers (5.3).
- **Don't set `is_active = true` on a deal a clinic owner submitted.** Owner deals start inactive on
  purpose, and an admin publishes them. A trigger blocks the website's roles. The service role
  isn't blocked, so this rule is on you.
- **Don't write to `master_business_info` from anything except the service role.** Admins may
  correct five contact columns there. Anything else comes from you.

---

## 7. Checks to run before you finish a batch

Each query should return **0 rows**, or only rows you meant to leave that way.

```sql
-- A. Tables you created in public (backups, staging, scratch)
select table_name from information_schema.tables
 where table_schema = 'public'
   and (table_name like 'qa\_%' or table_name like 'bak\_%' or table_name like '%backup%');

-- B. Visible estimates
select id, offer_raw_text from promo_offer_master
 where is_active and offer_raw_text ~* '\(est\.?\)';

-- C. Blanket offers linked to a specific service
select m.id, m.offer_raw_text, i.item_name
  from promo_offer_master m join promo_offer_items i on i.offer_id = m.id
 where m.is_active and i.service_id is not null
   and m.offer_raw_text ~* ('(all services|any service|all products|all treatments|'
                            || 'products and services|gift card|skin ?care products)');

-- D. Blanket offers stored more than once at one clinic
select business_id, offer_raw_text, count(*), string_agg(id::text, ',')
  from promo_offer_master
 where is_active and offer_raw_text ~* '(all services|all products|products and services)'
 group by business_id, offer_raw_text having count(*) > 1;

-- E. A price that doesn't appear in the offer text. It accepts "$1,499",
--    "$1499.00" and "$10.5", and for a quantity offer the per-unit rate
--    ("$8.99/unit … 10 units" covers $89.90).
with x as (
  select m.id, m.discount_price p, m.offer_raw_text t,
         (select max(i.delivered_units) from promo_offer_items i
           where i.offer_id = m.id) qty
    from promo_offer_master m
   where m.is_active and m.discount_price > 0
), amounts as (
  select x.id, x.p, x.t, a.amount, round((a.amount - trunc(a.amount)) * 100)::int cents
    from x cross join lateral
         (values (x.p), (case when x.qty >= 2 then round(x.p / x.qty, 2) end)) a(amount)
   where a.amount is not null
), pat as (
  select id, p, t,
         '(^|[^0-9.,])(' || to_char(trunc(amount), 'FM999999')
         || '|' || to_char(trunc(amount), 'FM999,999') || ')'
         || case when cents = 0 then '(\.00?)?'
                 when cents % 10 = 0 then '\.' || (cents / 10) || '0?'
                 else '\.' || lpad(cents::text, 2, '0') end
         || '([^0-9]|$)' re
    from amounts
)
select id, p as discount_price, t as offer_raw_text
  from pat group by id, p, t having bool_and(t !~ re) order by id;
```

After our repairs on 2026-09-30 these return A = 0, B = 0, C = 0, D = 0 and E = 8. E's 8 are the
accepted arithmetic rows in 5.3, the same rows the site's own check lists. There's no query for a placeholder quantity: 577 items
have `delivered_units = 1`, and most are genuinely one session or syringe. The rule is simply
never to write `1` when the text doesn't say one.

Our side runs two gates every 6 hours:
- **`schema:check`** compares the live schema with our snapshot.
- **`prices:check`** runs the site's own rules over every visible priced offer. Today it checks 469,
  and apart from the 8 accepted rows in 5.3 it finds nothing.

When either one flags something from your side, we'll send you the IDs.

---

## 8. What we do on our side

**Done on 2026-09-30**, all as tracked migrations: stopped the service trigger overwriting titles
(5.1), repaired business 1720's split discounts (5.2), stored the stated discount on 8 rows instead of
a computed price (5.3), and revoked the client grants on the two staging tables (5.5).

**Ongoing:**

- **Keep the site honest about the data.** A price not in the text isn't printed (3.5). A regular price
  not in the text isn't used (3.6). Blanket offers get no badge (3.3). Every deal says how sure we
  are (3.7).
- **Map any new `service_category`** as soon as you tell us about it.
- **Read `price_unit`** as soon as it exists (5.4).
- **Show the "last seen" date** once you record it (5.7).
- **Keep the drift and price gates running every 6 hours.** A red gate means the gate is working. We
  don't suppress it. The one time we treated it as a false positive, it was hiding the admin
  lockout.
- **Since 2026-09-30, the website's roles can only read `promo_offer_terms`.** It was the last pipeline
  table they could write. Your service-role writes are unaffected.
