# CostFinders v2 Design System — Warm Sand

> Master design reference. Direction: Light premium + deep amber accents + spa-lobby warmth.
> Stack: Next.js 16 + Tailwind CSS v4 + Phosphor Icons
>
> **LOGIC:** When building a page, check `design-system/pages/[page].md` first.
> If that file exists, its rules **override** this Master file.

---

## Color Palette

### Backgrounds (Warm Sand)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-bg-base` | `#e8ddd0` | Page background |
| `--color-bg-surface` | `#f2ebe2` | Cards, panels |
| `--color-bg-elevated` | `#faf5ee` | Hover states, active surfaces |
| `--color-bg-overlay` | `rgba(69, 26, 3, 0.4)` | Modal backdrop |

### Accent (Deep Amber Brown)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-accent` | `#92400e` | Primary CTA, active links |
| `--color-accent-hover` | `#b45309` | CTA hover |
| `--color-accent-muted` | `rgba(146, 64, 14, 0.08)` | Badge/chip bg tint |
| `--color-accent-text` | `#ffffff` | Text on accent buttons |

### Text (Dark Browns)

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-text-primary` | `#451a03` | Headings, primary |
| `--color-text-secondary` | `#78350f` | Descriptions, labels |
| `--color-text-muted` | `#92400e` | Timestamps, metadata |
| `--color-text-inverse` | `#ffffff` | Text on dark surfaces |

### Semantic

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-savings` | `#059669` | "Save X%", discount badges |
| `--color-savings-bg` | `rgba(5, 150, 105, 0.1)` | Savings badge bg |
| `--color-error` | `#dc2626` | Error states |
| `--color-error-bg` | `rgba(220, 38, 38, 0.1)` | Error bg tint |
| `--color-warning` | `#ea580c` | Warnings, expiring |
| `--color-warning-bg` | `rgba(234, 88, 12, 0.1)` | Warning bg tint |
| `--color-info` | `#2563eb` | Info, secondary links |
| `--color-info-bg` | `rgba(37, 99, 235, 0.1)` | Info bg tint |

### Borders

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-border-default` | `#d4c4b0` | Dividers, card borders |
| `--color-border-hover` | `#c4b09a` | Hover emphasis |
| `--color-border-accent` | `rgba(146, 64, 14, 0.3)` | Focused inputs |

---

## Typography

### Font

**Sora** — geometric, modern, warm. Loaded via `next/font/google`. Manrope as fallback.

```
--font-sans: 'Sora', 'Manrope', system-ui, sans-serif;
--font-mono: ui-monospace, 'SFMono-Regular', monospace;
```

### Scale

| Name | Size | Weight | Example |
|------|------|--------|---------|
| `display` | 48px / 3rem | 700 | Hero headlines |
| `h1` | 36px / 2.25rem | 700 | Page titles |
| `h2` | 24px / 1.5rem | 600 | Section titles |
| `h3` | 20px / 1.25rem | 600 | Card titles |
| `body` | 16px / 1rem | 400 | Default text |
| `body-sm` | 14px / 0.875rem | 400 | Labels, secondary |
| `caption` | 12px / 0.75rem | 500 | Badges, metadata |

### Pricing Pattern

```
Original:  text-[var(--color-text-muted)] line-through font-mono text-base
Current:   text-[var(--color-accent)] font-bold font-mono text-2xl
Savings:   text-[var(--color-savings)] font-semibold text-sm (badge)
```

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | Subtle elements |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.06)` | Cards |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,0.08)` | Modals |
| `--shadow-glow` | `0 0 16px rgba(146,64,14,0.1)` | Featured/promoted items |
| `--shadow-card-hover` | `0 4px 16px rgba(0,0,0,0.08), inset 0 0 0 1px rgba(146,64,14,0.15)` | Card hover |

---

## Radius

| Token | Value | Usage |
|-------|-------|-------|
| `sm` | 6px | Buttons, inputs |
| `md` | 10px | Cards |
| `lg` | 16px | Large containers, hero |
| `full` | 9999px | Pills, badges, avatars |

---

## Component Specs

### Buttons

| Variant | Classes |
|---------|---------|
| **Primary** | `bg-[var(--color-accent)] text-white font-semibold hover:bg-[var(--color-accent-hover)] rounded-md px-4 py-2.5` |
| **Secondary** | `bg-[var(--color-bg-surface)] text-[var(--color-text-primary)] border border-[var(--color-border-default)] hover:bg-[var(--color-bg-elevated)] rounded-md px-4 py-2.5` |
| **Ghost** | `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-muted)] rounded-md px-4 py-2.5` |
| **Danger** | `bg-[var(--color-error-bg)] text-[var(--color-error)] hover:bg-red-100 rounded-md px-4 py-2.5` |
| **All** | Add `transition-colors duration-200 cursor-pointer` |

### Cards

```
bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-[10px]
hover:border-[var(--color-border-hover)] hover:shadow-[var(--shadow-card-hover)]
transition-all duration-200 cursor-pointer
```

### Deal Cards

- **Image**: 4:3 aspect ratio, `rounded-t-[10px]`
- **Savings badge**: Top-right, `bg-[var(--color-savings-bg)] text-[var(--color-savings)] rounded-full px-3 py-1 text-xs font-semibold`
- **Category pill**: `bg-[var(--color-accent-muted)] text-[var(--color-accent)] rounded-full px-3 py-1 text-xs`
- **Price**: Original strikethrough + bold accent current
- **CTA**: `[Claim Deal]` primary button

### Inputs

```
bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)]
placeholder:text-[var(--color-text-muted)]
focus:border-[var(--color-border-accent)] focus:ring-1 focus:ring-[var(--color-border-accent)]
rounded-md px-3 py-2.5 transition-colors duration-200
```

### Navigation (Header)

```
bg-[var(--color-bg-base)]/95 backdrop-blur-sm border-b border-[var(--color-border-default)]
sticky top-0 z-50 h-16
```

- Logo: `text-[var(--color-accent)] font-bold text-xl`
- Links: `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`
- Active: `text-[var(--color-accent)]`
- CTA button: primary

### Sidebar (Dashboards)

```
bg-[var(--color-bg-surface)] border-r border-[var(--color-border-default)] w-64
```

- Nav items: `text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-accent-muted)] rounded-md px-3 py-2`
- Active: `text-[var(--color-accent)] bg-[var(--color-accent-muted)]`
- Active indicator: `border-l-2 border-[var(--color-accent)]`

---

## Page Patterns

### Homepage (Marketplace)

1. **Hero** — Warm gradient, bold headline, search bar, category chips
2. **Trending Deals** — Horizontal scroll / 3-col grid, savings-forward cards
3. **Categories** — Icon + label grid
4. **How It Works** — 3 steps: Browse → Claim → Save
5. **Trust** — Stats or social proof
6. **Business CTA** — Contrasting section "List your medspa"

### Deals Browse

1. **Filter bar** — Sticky, category pills + location + price range
2. **Results grid** — 2-3 column responsive cards
3. **Deal cards** — Image, treatment, savings badge, price comparison, CTA

### Dashboards

1. **Sidebar** — Surface bg, accent active states
2. **Main content** — Base bg, surface cards
3. **Metric cards** — Large number, label, subtle trend indicator

---

## Anti-Patterns

- No dark backgrounds (stone-800/900/950) — this is a light theme
- No `amber-300`/`amber-400` for text/accents (too bright on beige — use CSS variables)
- No emojis as icons (Phosphor Icons only)
- No layout-shifting hover transforms (color/shadow only)
- No pink/magenta (deprecated brand color)
- No blue-slate backgrounds (deprecated `#4c5578`)
- No zinc-based neutrals (too cold — warm sand only)
- Amber is accent only — don't make everything amber

---

## Pre-Delivery Checklist

- [ ] Phosphor Icons only (no Heroicons, Lucide, or emojis)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Smooth transitions (150-300ms) on hover/focus
- [ ] Text contrast 4.5:1 minimum (`#451a03` on `#e8ddd0` = 9.8:1 ✓)
- [ ] Visible focus states for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content behind fixed header (h-16 clearance)
- [ ] No horizontal scroll on mobile
- [ ] Use CSS variables (`var(--color-*)`) not hardcoded hex in Tailwind classes
