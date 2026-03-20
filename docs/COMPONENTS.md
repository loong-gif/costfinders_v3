# Component Architecture

> Strict 4-layer component hierarchy. Import rules: each layer can only import from layers below it.

---

## Layer 1: UI Primitives (`src/components/ui/`)

Design primitives with zero business logic. Only import external libraries.

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| **Badge** | `badge.tsx` | Semantic status indicator | `variant`: default/success/warning/error/info/brand, `size`: sm/md |
| **Button** | `button.tsx` | Interactive button with loading state | `variant`: primary/secondary/ghost/danger, `size`: sm/md/lg, `isLoading` |
| **Card** | `card.tsx` | Container with sub-components | `variant`: glass/solid/outline, `padding`: none/sm/md/lg, `hover` |
| **Input** | `input.tsx` | Text input with label/error/hint | `label`, `error`, `hint` |
| **Modal** | `modal.tsx` | Overlay dialog with mobile variants | `size`: sm/md/lg/xl, `mobileVariant`: default/fullscreen/bottom |
| **BottomSheet** | `bottomSheet.tsx` | Mobile slide-up dialog | `height`: auto/half/full |
| **Breadcrumb** | `breadcrumb.tsx` | Navigation trail (collapses on mobile) | `items`: `{label, href?}[]` |
| **Faq** | `faq.tsx` | Accordion using native `<details>` | `items`: `{question, answer}[]` |
| **RelatedLinks** | `relatedLinks.tsx` | Cross-navigation link grid for SEO | `title`, `links`: `{label, href, description?}[]` |
| **Skeleton** | `skeleton.tsx` | Loading placeholders | Exports: Skeleton, SkeletonCard, SkeletonText, SkeletonAvatar |
| **Tooltip** | `tooltip.tsx` | Positioned tooltip with portal rendering | `content`, `side`: top/right/bottom/left, `delay` |

## Layer 2: Patterns (`src/components/patterns/`)

Reusable compositions. Can import from `ui/` and external libs.

| Component | File | Purpose | Key Props |
|-----------|------|---------|-----------|
| **AreaFilter** | `areaFilter.tsx` | Neighborhood dropdown selector | `areas`, `selectedArea`, `onSelect` |
| **BlurredImage** | `blurredImage.tsx` | Blurred image with lock overlay (anonymous) | `src`, `alt`, `fill`, `priority` |
| **CategoryFilter** | `categoryFilter.tsx` | Horizontal pill filter for treatments | `selected`, `onChange` |
| **CityPicker** | `cityPicker.tsx` | Searchable city dropdown | `cities`, `selectedCity`, `onSelect` |
| **ClaimStatusBadge** | `claimStatusBadge.tsx` | Status badge (pending→warning, booked→success) | `status`, `size` |
| **PageHeader** | `pageHeader.tsx` | Breadcrumb + title header for dashboards | `title?`, `showBack?`, `backUrl?` |
| **PriceRangeFilter** | `priceRangeFilter.tsx` | Dual min/max price inputs | `minPrice`, `maxPrice`, `onChange` |
| **SaveButton** | `saveButton.tsx` | Heart icon to favorite deals | `dealId`, `size` |
| **SortSelector** | `sortSelector.tsx` | Deal sort dropdown (popular/newest/price/discount) | `value`, `onChange` |

## Layer 3: Features (`src/components/features/`)

Domain components with data and business logic. Can import from `ui/`, `patterns/`, and external libs.

### Homepage (`features/homepage/`)
| Component | Purpose |
|-----------|---------|
| `heroSection.tsx` | Hero banner with category picker and stats |
| `categoryGrid.tsx` | Treatment categories grid |
| `categoryPreviewSection.tsx` + `categoryPreviewCard.tsx` | Category showcase |
| `cityGrid.tsx` | City shortcuts grid |
| `valuePropsSection.tsx` | Feature highlights section |
| `businessCtaSection.tsx` | CTA for business signups |

### Deals (`features/deals/`)
| Component | Purpose |
|-----------|---------|
| `cityDealsPage.tsx` | City-scoped deals listing page |
| `treatmentCityPage.tsx` | Treatment + city combination page |
| `dealDetailPage.tsx` | Full deal detail view |
| `dealsRedirect.tsx` | Auto-location detection redirect |

### Deal Display
| Component | Purpose |
|-----------|---------|
| `dealCard.tsx` | Deal card with image, pricing, location (grid/list variants) |
| `dealCardSkeleton.tsx` | Loading placeholder matching dealCard layout |
| `dealsGrid.tsx` | Grid/list view switcher with loading/empty states |
| `dealSidebar.tsx` | Contextual sidebar (auth wall vs business info) |
| `offerCard.tsx` | Promotional offer card with pricing |

### Auth & Verification
| Component | Purpose |
|-----------|---------|
| `authModal.tsx` | Modal switching between sign-in and sign-up |
| `signInForm.tsx` | Email/password sign-in form |
| `signUpForm.tsx` | Registration form |
| `emailVerification.tsx` | Email verification code input |
| `phoneVerification.tsx` | Phone verification code input |
| `claimCTA.tsx` | CTA encouraging anonymous users to sign in |

### Business Features
| Component | Purpose |
|-----------|---------|
| `businessInfo.tsx` | Verified business info card (for authenticated users) |
| `businessSearchModal.tsx` | Search and claim unverified businesses |
| `businessProfileForm.tsx` | Business profile editing form |
| `createBusinessForm.tsx` | New business registration form |
| `claimBusinessFlow.tsx` | Multi-step business ownership claim wizard |
| `claimDealModal.tsx` | Modal to initiate deal claim |

### Deal Management (`features/dealManagement/`)
| Component | Purpose |
|-----------|---------|
| `dealForm.tsx` | Create/edit deal form |
| `dealList.tsx` | Table view of deals with actions |

### Deal Moderation (`features/dealModeration/`)
| Component | Purpose |
|-----------|---------|
| `dealModerationCard.tsx` | Admin deal moderation card (approve/reject) |

### Lead Management (`features/leadManagement/`)
| Component | Purpose |
|-----------|---------|
| `leadList.tsx` | Table view of leads |
| `leadDetail.tsx` | Lead detail with response actions |

### Admin (`features/admin/`)
| Component | Purpose |
|-----------|---------|
| `businessTable.tsx` | Admin business management table |
| `consumerTable.tsx` | Admin consumer management table |
| `businessBillingOverride.tsx` | Admin billing adjustment tool |

### Analytics (`features/analytics/`)
| Component | Purpose |
|-----------|---------|
| `analyticsDashboard.tsx` | Business performance metrics dashboard |

### Messaging (`features/messaging/`)
| Component | Purpose |
|-----------|---------|
| `messageThread.tsx` | Chat thread display |

### Monetization & Billing
| Component | Purpose |
|-----------|---------|
| `pricingTierCard.tsx` | Pricing tier option card |
| `pricingHubHeader.tsx` | Pricing page header |
| `pricingBreakdown.tsx` | Pricing detail breakdown |
| `leadPackagesGrid.tsx` | Lead credit package options |
| `leadCostCard.tsx` | Lead pricing display |
| `leadBalanceCard.tsx` | Account balance display |
| `leadPurchaseModal.tsx` | Lead package purchase modal |
| `sponsoredDealConfig.tsx` | Sponsored deal settings |
| `billingHistory.tsx` | Transaction/billing records |
| `paymentMethods.tsx` | Saved payment methods |
| `mockPaymentForm.tsx` | Test payment form (no real processing) |

### User Features
| Component | Purpose |
|-----------|---------|
| `profileForm.tsx` | User profile editing |
| `alertPreferences.tsx` | Notification preferences |
| `claimCard.tsx` | Deal claim status card |
| `filterPanel.tsx` | Combined filter panel (category, area, price, sort) |
| `locationSelector.tsx` | Multi-step location picker |
| `cityCard.tsx` | City info card |
| `neighborhoodCard.tsx` | Neighborhood info card |

## Layer 4: Layout (`src/components/layout/`)

App shell and navigation. Can import from all layers.

| Component | File | Purpose |
|-----------|------|---------|
| **GlobalHeader** | `globalHeader.tsx` | Fixed top nav bar (logo, location, auth). Hidden on dashboard routes. |
| **BaseSidebar** | `baseSidebar.tsx` | Reusable sidebar: desktop icon-only + mobile bottom nav with "More" overflow |
| **DashboardSidebar** | `dashboardSidebar.tsx` | Consumer dashboard nav (My Deals, Favorites, Claims, Settings) |
| **BusinessDashboardSidebar** | `businessDashboardSidebar.tsx` | Business nav (8 items, `mobileNavCount=4`) |
| **AdminDashboardSidebar** | `adminDashboardSidebar.tsx` | Admin nav (9 items, `mobileNavCount=4`) |
| **AuthenticatedDashboardLayout** | `authenticatedDashboardLayout.tsx` | Auth-gated layout wrapper with loading state |
| **LocationDisplay** | `locationDisplay.tsx` | Header location button with modal selector |

## SEO Components (`src/components/seo/`)

Server components emitting JSON-LD structured data.

| Component | File | Schema Type |
|-----------|------|------------|
| **BreadcrumbSchema** | `breadcrumbSchema.tsx` | `BreadcrumbList` |
| **FaqSchema** | `faqSchema.tsx` | `FAQPage` |
| **OrganizationSchema** | `organizationSchema.tsx` | `Organization` |
| **WebsiteSchema** | `websiteSchema.tsx` | `WebSite` |

---

## Import Rules

| Layer | Can Import From |
|-------|-----------------|
| `ui/` | External libraries only |
| `patterns/` | `ui/`, external libs |
| `features/` | `ui/`, `patterns/`, external libs |
| `layout/` | All layers |

**If upward import needed** → extract to lower layer.

**No barrel files** — import directly: `import { Badge } from '@/components/ui/badge'`
