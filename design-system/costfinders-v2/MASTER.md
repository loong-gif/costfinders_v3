# CostFinders v2 Design System — Bold & Warm

> Master design reference. Direction: Dark premium + amber accents + deal-forward.
> Stack: Next.js 16 + Tailwind CSS v4 + Phosphor Icons
>
> **LOGIC:** When building a page, check `design-system/pages/[page].md` first.
> If that file exists, its rules **override** this Master file.

---

## Color Palette

### Backgrounds (Stone-based warm neutrals)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `--bg-base` | `stone-950` | `#0c0a09` | Page background |
| `--bg-surface` | `stone-900` | `#1c1917` | Cards, panels |
| `--bg-elevated` | `stone-800` | `#292524` | Hover states, active surfaces |
| `--bg-overlay` | — | `rgba(12,10,9,0.8)` | Modal backdrop |

### Accent (Amber)

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `--accent` | `amber-400` | `#fbbf24` | Primary CTA, active links |
| `--accent-hover` | `amber-300` | `#fcd34d` | CTA hover |
| `--accent-muted` | — | `rgba(251,191,36,0.15)` | Badge/chip bg tint |
| `--accent-text` | `stone-950` | `#0c0a09` | Text on amber buttons |

### Text

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `--text-primary` | `stone-100` | `#f5f5f4` | Headings, primary |
| `--text-secondary` | `stone-400` | `#a8a29e` | Descriptions, labels |
| `--text-muted` | `stone-500` | `#78716c` | Timestamps, metadata |
| `--text-inverse` | `stone-950` | `#0c0a09` | Text on amber surfaces |

### Semantic

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `--savings` | `emerald-400` | `#34d399` | "Save X%", discount badges |
| `--savings-bg` | — | `rgba(52,211,153,0.15)` | Savings badge bg |
| `--error` | `red-400` | `#f87171` | Error states |
| `--error-bg` | — | `rgba(248,113,113,0.15)` | Error bg tint |
| `--warning` | `orange-400` | `#fb923c` | Warnings, expiring |
| `--info` | `blue-400` | `#60a5fa` | Info, secondary links |

### Borders

| Token | Tailwind | Hex | Usage |
|-------|----------|-----|-------|
| `--border-default` | `stone-800` | `#292524` | Dividers, card borders |
| `--border-hover` | `stone-700` | `#44403c` | Hover emphasis |
| `--border-accent` | — | `rgba(251,191,36,0.3)` | Focused inputs |

---

## Typography

### Font

**Sora** — geometric, modern, warm. Loaded via `next/font/google`.

```
--font-sans: 'Sora', system-ui, sans-serif;
--font-mono: 'Geist Mono', ui-monospace, monospace;
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
Original:  text-stone-500 line-through font-mono text-base
Current:   text-amber-400 font-bold font-mono text-2xl
Savings:   text-emerald-400 font-semibold text-sm (badge)
```

---

## Shadows

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.3)` | Subtle elements |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.4)` | Cards |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.5)` | Modals |
| `--shadow-glow` | `0 0 20px rgba(251,191,36,0.15)` | Featured/promoted items |
| `--shadow-card-hover` | `0 8px 24px rgba(0,0,0,0.5), inset 0 0 0 1px rgba(251,191,36,0.2)` | Card hover |

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
| **Primary** | `bg-amber-400 text-stone-950 font-semibold hover:bg-amber-300 rounded-md px-4 py-2.5` |
| **Secondary** | `bg-stone-800 text-stone-100 border border-stone-700 hover:bg-stone-700 rounded-md px-4 py-2.5` |
| **Ghost** | `text-stone-400 hover:text-stone-100 hover:bg-stone-800/50 rounded-md px-4 py-2.5` |
| **Danger** | `bg-red-400/15 text-red-400 hover:bg-red-400/25 rounded-md px-4 py-2.5` |
| **All** | Add `transition-colors duration-200 cursor-pointer` |

### Cards

```
bg-stone-900 border border-stone-800 rounded-[10px]
hover:border-stone-700 hover:shadow-[0_8px_24px_rgba(0,0,0,0.5)]
transition-all duration-200 cursor-pointer
```

### Deal Cards

- **Image**: 4:3 aspect ratio, `rounded-t-[10px]`
- **Savings badge**: Top-right, `bg-emerald-400/15 text-emerald-400 rounded-full px-3 py-1 text-xs font-semibold`
- **Category pill**: `bg-amber-400/15 text-amber-400 rounded-full px-3 py-1 text-xs`
- **Price**: Original strikethrough + bold amber current
- **CTA**: `[Claim Deal]` amber primary button

### Inputs

```
bg-stone-900 border border-stone-800 text-stone-100
placeholder:text-stone-500
focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20
rounded-md px-3 py-2.5 transition-colors duration-200
```

### Navigation (Header)

```
bg-stone-950/95 backdrop-blur-sm border-b border-stone-800
sticky top-0 z-50 h-16
```

- Logo: `text-amber-400 font-bold text-xl`
- Links: `text-stone-400 hover:text-stone-100`
- Active: `text-amber-400`
- CTA button: amber primary

### Sidebar (Dashboards)

```
bg-stone-900 border-r border-stone-800 w-64
```

- Nav items: `text-stone-400 hover:text-stone-100 hover:bg-stone-800/50 rounded-md px-3 py-2`
- Active: `text-amber-400 bg-amber-400/10`
- Active indicator: `border-l-2 border-amber-400`

---

## Page Patterns

### Homepage (Marketplace)

1. **Hero** — Dark gradient, bold headline, search bar, category chips
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

1. **Sidebar** — stone-900, amber active states
2. **Main content** — stone-950 bg, stone-900 cards
3. **Metric cards** — Large number, label, subtle trend indicator

---

## Anti-Patterns

- No glassmorphism (no backdrop-blur on cards, no transparent bg)
- No emojis as icons (Phosphor Icons only)
- No layout-shifting hover transforms (color/shadow only)
- No pink/magenta (old brand color)
- No blue-slate backgrounds (old #4c5578)
- No zinc-based neutrals (too cold — use stone)
- Amber is accent only — don't make everything amber

---

## Pre-Delivery Checklist

- [ ] Phosphor Icons only (no Heroicons, Lucide, or emojis)
- [ ] `cursor-pointer` on all clickable elements
- [ ] Smooth transitions (150-300ms) on hover/focus
- [ ] Text contrast 4.5:1 minimum (stone-100 on stone-950 = 15.4:1 ✓)
- [ ] Visible focus states for keyboard nav
- [ ] `prefers-reduced-motion` respected
- [ ] Responsive: 375px, 768px, 1024px, 1440px
- [ ] No content behind fixed header (h-16 clearance)
- [ ] No horizontal scroll on mobile
