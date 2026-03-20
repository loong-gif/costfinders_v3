# CostFinders - Project Instructions

> Project vision/requirements: `.planning/PROJECT.md` (managed by `/gsd:*` commands)
> Global standards: `~/.claude/PRINCIPLES.md`

## Tech Stack Additions

Project-specific additions to global stack (Next.js 16 + React + TS + Tailwind):

- **Images**: Cloudinary (storage + optimization)
- **Font**: Sora (via next/font, Manrope fallback)
- **Icons**: Phosphor Icons only (`@phosphor-icons/react`)
- **Hosting**: Vercel
- **Database**: Supabase (project: "costfinder", `kdlpkjzcnbkjcvwsvlwn`)
  - `master_business_info` (354 businesses) → business profiles
  - `promo_offer_master` (347 offers) → deals/promotions
  - See `docs/DATABASE.md` for full schema
- **Design System**: Warm Sand (see `design-system/costfinders-v2/MASTER.md`)

---

## Frontend Architecture

Strict layered component architecture.

### Component Layers

```
src/components/
  ui/        → Layer 1: Design Primitives (no business logic)
  patterns/  → Layer 2: Reusable compositions (business-agnostic)
  features/  → Layer 3: Domain components (with data/logic)
  layout/    → App shell & navigation
```

### Import Rules (CRITICAL)

| Layer | Can Import From |
|-------|-----------------|
| `ui/` | External libraries only |
| `patterns/` | `ui/`, external libs |
| `features/` | `ui/`, `patterns/`, external libs |
| `layout/` | All layers |

**If upward import needed** → Extract to lower layer instead.

### App Structure

```
src/
  app/
    (public)/          # marketing, auth
    (app)/             # authenticated
    api/               # API routes
    layout.tsx
  components/
    ui/ → patterns/ → features/ → layout/
  lib/
    actions/           # Server Actions
    utils/             # Helpers
  types/
```

---

## Design System

### Tokens

- **Tier 1**: CSS variables in `globals.css`
- **Tier 2**: JS tokens in `src/lib/design-tokens.ts` (if present)

```tsx
// ❌ className="bg-[#FF6D00]"
// ✅ className="bg-brand-primary"
```

### Icons (Phosphor Only)

```tsx
import { House, User } from "@phosphor-icons/react";
<House size={20} weight="light" />   // default
<House size={20} weight="fill" />    // active
```

### Defaults

| Element | Default |
|---------|---------|
| Radius | `rounded-xl`, containers `rounded-2xl` |
| Padding | `px-4 sm:px-6 lg:px-8` |
| Container | `max-w-6xl` standard, `max-w-7xl` wide |

### Layout Pattern

Standard page structure with fixed header clearance:

```tsx
<PageWrapper moduleId="example">
  <GlobalHeader module="example" />
  <main className="pt-20 pb-20 md:pb-0 px-4 sm:px-6 lg:px-8">
    <div className="max-w-7xl mx-auto">
      {/* Page content */}
    </div>
  </main>
</PageWrapper>
```

| Class | Purpose |
|-------|---------|
| `pt-20` | Clear fixed header (80px) |
| `pb-20 md:pb-0` | Mobile bottom nav clearance, none on desktop |
| `px-4 sm:px-6 lg:px-8` | Responsive horizontal padding |
| `max-w-7xl mx-auto` | Centered wide container |

---

## Conventions

- **Components**: camelCase (`crofileHeader.tsx`)
- **Utilities**: camelCase (`useSomething.ts`)
- **Server-first**: Default Server Components; `'use client'` only when needed
- **No barrel files**: Import directly, not through index.ts

---

## Commands

```bash
npm run dev       # Development
npm run build     # Production build
npm run lint      # Biome linter
npm run check     # Lint + format
```

---

## Key Files

- `src/app/layout.tsx` - Root layout
- `src/lib/design-tokens.ts` - Design system (if present)
- `docs/MESSAGING-STYLE-GUIDE.md` - Messaging patterns and copy standards
- `.planning/PROJECT.md` - Project vision (GSD-managed)
- `.planning/ROADMAP.md` - Development phases (GSD-managed)

---

## Self-Documentation

### After Feature Implementation
- Update structure if directories changed
- Create `src/[feature]/CONTEXT.md` for modules with 3+ files
- **Update `.planning/PAGES.md`** when creating new pages (add route + description)
- **Consult `docs/MESSAGING-STYLE-GUIDE.md`** for all copy-related changes (error messages, success states, form labels, notifications)

### Standards
- **Reference, don't copy**: Link to files (`src/lib/auth.ts:45`)
- **Why over what**: Document rationale
- **Token budget**: Keep under 1500 tokens

---

## UI Testing Rule (CRITICAL)

**After creating or modifying any page UI, ALWAYS:**

1. Use Chrome browser automation (`mcp__claude-in-chrome__*` tools) to navigate to the page
2. Take a screenshot to visually verify the design
3. Test all clickable elements (buttons, links, interactive components)
4. Analyze the screenshot to ensure:
   - Glassmorphic styling is correctly applied
   - Layout matches design intent
   - No visual regressions or broken styles
   - Responsive behavior works as expected

**This is mandatory** — never assume UI changes are correct without visual verification.

---

## Project-Specific Overrides

| Override | Reason |
|----------|--------|
| Warm Sand design | Light beige theme with deep amber accents, spa-lobby warmth, strategic whitespace |
| Mock data only | UI-only build; backend team handles Supabase integration separately |
| Role-based views | Single app serves consumer, business, and admin experiences |
| Anonymous until committed | Business details hidden until user creates account + verifies |

---

## Design References

- **Kayak**: Comparison UX patterns
- **Groupon**: Deal presentation
- **Zocdoc**: Booking flows

---

# Global Config Imports
@~/.claude/PRINCIPLES.md
@~/.claude/RULES.md
@~/.claude/MCP_Context7.md
@~/.claude/MCP_Sequential.md
@~/.claude/MCP_Serena.md
@~/.claude/MCP_Linear.md
