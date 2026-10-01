/**
 * WCAG contrast, computed from the tokens in globals.css rather than trusted from a comment.
 *
 * Warm Sand is a LIGHT theme on a mid-tone ground (#e8ddd0), which is the case Tailwind's
 * default palette is not tuned for: every mid-500/600 value that looks fine on white measured
 * 2.40–3.61:1 here. Eight tokens shipped below 4.5:1 across deal cards, status badges, inline
 * form errors and every raw `text-emerald-600` / `text-red-600` utility, and the CSS now carries the
 * corrected ratios in comments — which is exactly the kind of claim that rots the next time
 * someone reaches for a brighter green.
 *
 * The shape that matters is a token used as TEXT on its own 10% tint (the "Save $X" badge,
 * `bg-[var(--color-savings-bg)] text-[var(--color-savings)]`): the tint lifts the background
 * toward the text, so a token can pass on plain sand and fail in the badge it was made for.
 * Every ratio below is computed with the sRGB relative-luminance formula from WCAG 2.1 §1.4.3,
 * over the composited tint, against the DARKEST ground — the worst case a token can land on.
 *
 * There is no contrast helper in src/ to import: these are CSS custom properties consumed by
 * Tailwind, so the source of truth is the stylesheet and the arithmetic has to live here.
 */
import { strict as assert } from 'node:assert'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CSS = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    '..',
    'src/app/globals.css',
  ),
  'utf8',
)

type Rgba = { r: number; g: number; b: number; a: number }

/** One custom property's declared value, or null when globals.css does not declare it. */
function declared(name: string): string | null {
  const match = CSS.match(new RegExp(`^\\s*--${name}:\\s*([^;]+);`, 'm'))
  return match ? match[1].trim() : null
}

/** Read one custom property's declared value out of globals.css. */
function token(name: string): string {
  const value = declared(name)
  assert.ok(value, `--${name} is not declared in src/app/globals.css`)
  return value
}

function parseColor(value: string): Rgba {
  const rgba = value.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/,
  )
  if (rgba) {
    return {
      r: Number(rgba[1]),
      g: Number(rgba[2]),
      b: Number(rgba[3]),
      a: rgba[4] === undefined ? 1 : Number(rgba[4]),
    }
  }
  const hex = value.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  assert.ok(hex, `not a colour this test can read: ${value}`)
  const h =
    hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1]
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16),
    a: 1,
  }
}

const color = (name: string) => parseColor(token(name))

/** WCAG 2.1 relative luminance. */
function luminance({ r, g, b }: Rgba): number {
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** Source-over composite of a translucent colour onto an opaque one. */
function over(fg: Rgba, bg: Rgba): Rgba {
  const mix = (f: number, b: number) => Math.round(fg.a * f + (1 - fg.a) * b)
  return { r: mix(fg.r, bg.r), g: mix(fg.g, bg.g), b: mix(fg.b, bg.b), a: 1 }
}

function ratio(a: Rgba, b: Rgba): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const round = (n: number) => Math.round(n * 100) / 100

const GROUNDS = [
  'color-bg-base',
  'color-bg-surface',
  'color-bg-elevated',
] as const

/**
 * The darkest of the three light grounds — the worst case for dark text and for a tinted
 * badge. Computed, not named: under Warm Sand it was bg-base (#e8ddd0); under the white
 * theme the page is #ffffff and the grey band (bg-surface, #f4f5f7) is the darkest ground a
 * badge can land on. Naming one of them here is exactly the assumption that goes stale.
 */
const DARKEST = [...GROUNDS].sort(
  (a, b) => luminance(color(a)) - luminance(color(b)),
)[0]

test('the darkest ground is a light ground (dark text on it is the intended reading)', () => {
  assert.ok(
    luminance(color(DARKEST)) > 0.5,
    `--${DARKEST} is dark; every threshold below assumes dark text on a light ground`,
  )
})

/**
 * Text tokens paired with the 10% tint they sit on. Each `-bg` must be its own foreground at
 * alpha 0.1 — a fg changed without its tint is its own regression, so that is asserted first.
 */
const TINTED = ['savings', 'error', 'warning', 'info', 'success'] as const

for (const name of TINTED) {
  test(`--color-${name} clears 4.5:1 as text on --color-${name}-bg over the darkest ground`, () => {
    const fg = color(`color-${name}`)
    const tint = color(`color-${name}-bg`)
    assert.deepEqual(
      { r: tint.r, g: tint.g, b: tint.b, a: tint.a },
      { r: fg.r, g: fg.g, b: fg.b, a: 0.1 },
      `--color-${name}-bg must be --color-${name} at alpha 0.1; it is ${token(`color-${name}-bg`)} against ${token(`color-${name}`)}`,
    )
    const measured = ratio(fg, over(tint, color(DARKEST)))
    assert.ok(
      measured >= 4.5,
      `${round(measured)}:1 — needs 4.5:1. ${token(`color-${name}`)} is too light for a badge on its own tint over ${token(DARKEST)}; go darker.`,
    )
  })
}

/** Body and link text, on every ground it can land on. */
for (const name of [
  'color-text-primary',
  'color-text-secondary',
  'color-text-muted',
  'color-accent',
  'color-accent-hover',
] as const) {
  test(`--${name} clears 4.5:1 on all three grounds`, () => {
    for (const ground of GROUNDS) {
      const measured = ratio(color(name), color(ground))
      assert.ok(
        measured >= 4.5,
        `--${name} on --${ground}: ${round(measured)}:1 — needs 4.5:1`,
      )
    }
  })
}

/**
 * Coral text on the coral tint — the "brand" badge, the active sidebar item, avatar initials.
 * --color-accent there measures 4.16:1 over the grey band (the tint pulls the ground toward the
 * text, as with the semantic badges above, and the accent has only 4.67:1 of headroom on the
 * band to begin with), so that shape takes --color-accent-hover. The Warm Sand codemod mapped
 * amber-800 → accent everywhere and put 16 of these below AA; the scan at the bottom of this
 * file keeps them from coming back.
 */
test('--color-accent-hover clears 4.5:1 as text on --color-accent-muted over the darkest ground', () => {
  const measured = ratio(
    color('color-accent-hover'),
    over(color('color-accent-muted'), color(DARKEST)),
  )
  assert.ok(measured >= 4.5, `${round(measured)}:1 — needs 4.5:1`)
})

test('--color-focus-ring clears 3:1 on all three grounds (WCAG 1.4.11)', () => {
  const ring = color('color-focus-ring')
  assert.equal(
    ring.a,
    1,
    'the ring must be solid: an alpha ring composites toward the ground it is meant to stand out from, which is how the previous amber-800/40 ring measured 1.8:1',
  )
  for (const ground of GROUNDS) {
    const measured = ratio(ring, color(ground))
    assert.ok(
      measured >= 3,
      `focus ring on --${ground}: ${round(measured)}:1 — non-text UI needs 3:1`,
    )
  }
})

/** Semantic colours used as solid backgrounds under white text (a success badge on an image). */
for (const name of ['color-success', 'color-error'] as const) {
  test(`--${name} carries white text at 4.5:1 as a solid background`, () => {
    const measured = ratio(parseColor(token('color-text-inverse')), color(name))
    assert.ok(measured >= 4.5, `${round(measured)}:1 — needs 4.5:1`)
  })
}

// ---------------------------------------------------------------------------
// The component layer: opacity-modified text classes.
//
// Everything above measures the tokens, which is why it passed while 56 text classes shipped
// below 4.5:1. `text-[#78350f]/60` is --color-text-secondary lightened at the point of use, and
// no amount of token arithmetic can see it. So this half reads the components: it finds every
// `text-<colour>/<alpha>` in the .tsx files under src/, composites the colour at that alpha over
// the ground it can actually be on, and holds it to the same 4.5:1.
//
// Opacity is the bug, not the fix. Three real text steps exist as real colours
// (--color-text-primary / -secondary / -muted) and they cover the hierarchy these modifiers were
// improvising; the failure message names the one to use.
// ---------------------------------------------------------------------------

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src')

/**
 * Blank out comments while preserving line numbering, so a comment that NAMES a class is not
 * reported as a use of it.
 *
 * Not cosmetic. Every fix this test drives wants a comment next to it saying which class was
 * removed and what it measured — and the first two written did exactly that and failed this test
 * on their own explanatory text. A scanner that cannot distinguish "uses text-white/70" from
 * "explains why text-white/70 was removed" makes documenting the fix impossible, which is the
 * opposite of the point.
 *
 * Newlines are preserved rather than the comment being deleted, because HITS reports line numbers.
 * `//` is only honoured at the start of a line: mid-line it is almost always a URL
 * (`https://…`), and blanking from there would silently drop real code after it.
 */
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/.*$/gm, (_m, indent) => indent)
}

/** Every .tsx file under src/, as [repo-relative path, comment-stripped source]. */
function tsxSources(): [string, string][] {
  return readdirSync(SRC, { recursive: true, encoding: 'utf8' })
    .filter((p) => p.endsWith('.tsx'))
    .sort()
    .map((p): [string, string] => [
      `src/${p}`,
      stripComments(readFileSync(join(SRC, p), 'utf8')),
    ])
}

/**
 * A text colour utility carrying an opacity modifier. The colour group is either an arbitrary
 * value (`text-[#78350f]/60`, `text-[var(--color-accent)]/60`) or a named one (`text-white/70`,
 * `text-emerald-600/80`). The lookbehind is `[\w-]` so a variant prefix still matches —
 * `hover:text-white/70` and `[&_svg]:text-white/50` are both real text colours.
 */
const OPACITY_TEXT =
  /(?<![\w-])text-(\[[^\]\s]+\]|[a-z]+(?:-\d{2,3})?)\/(\d{1,3})(?![\d.])/g

/** `text-sm/6` is font-size/line-height, not colour/opacity. */
const FONT_SIZE = /^(xs|sm|base|lg|xl|\d+xl)$/

type Hit = {
  file: string
  line: number
  cls: string
  value: string
  alpha: number
}

const HITS: Hit[] = tsxSources().flatMap(([file, src]) =>
  src.split('\n').flatMap((text, i) =>
    [...text.matchAll(OPACITY_TEXT)]
      .filter((m) => !FONT_SIZE.test(m[1]))
      .map((m) => ({
        file,
        line: i + 1,
        cls: m[0],
        value: m[1],
        alpha: Number(m[2]) / 100,
      })),
  ),
)

/** parseColor asserts on anything it cannot read; here that is an answer, not a failure. */
function tryParseColor(value: string): Rgba | null {
  try {
    return parseColor(value)
  } catch {
    return null
  }
}

/** The colour a `text-…` utility names, or null when this test cannot resolve it. */
function resolve(value: string): Rgba | null {
  if (value.startsWith('[')) {
    const inner = value.slice(1, -1)
    const variable = inner.match(/^var\(\s*--([\w-]+)\s*\)$/)
    return tryParseColor(variable ? token(variable[1]) : inner)
  }
  if (value === 'white') return { r: 255, g: 255, b: 255, a: 1 }
  if (value === 'black') return { r: 0, g: 0, b: 0, a: 1 }
  // Tailwind v4 resolves `text-success` to var(--color-success), so any colour globals.css
  // declares is readable; Tailwind's own palette is not in this repo (and the scan at the bottom
  // of this file keeps it out of src).
  const palette = declared(`color-${value}`)
  return palette ? tryParseColor(palette) : null
}

/** The darkest of the three light grounds, computed at the top of this file. */
const SAND = DARKEST

/**
 * The dark ground light text lands on: the accent, because it is the solid behind every
 * primary button's white label and the LIGHTEST ground white text is put on — so it is the
 * worst case for light text the way the darkest light ground is for dark text. The pages not
 * yet moved off Warm Sand still hardcode `bg-amber-800` (#92400e) and `bg-[#451a03]` under
 * their light text; both are darker than the accent, so passing here passes there too.
 */
const DARK = 'color-accent'

/**
 * Composite over both grounds and keep the better ratio. The two grounds are opposites — dark
 * text is only ever readable on sand, light text only on the dark ground — so the better ratio
 * identifies which ground a class is for without this test having to know what is behind every
 * component. A class that fails even its best case fails everywhere it could be.
 */
function bestCase(fg: Rgba, alpha: number) {
  return [SAND, DARK]
    .map((ground) => ({
      ground,
      measured: ratio(
        over({ ...fg, a: fg.a * alpha }, color(ground)),
        color(ground),
      ),
    }))
    .sort((a, b) => b.measured - a.measured)[0]
}

/** The lightest real text token that still clears 4.5:1 on sand — the replacement to name. */
const MUTED = (() => {
  const steps = [
    'color-text-muted',
    'color-text-secondary',
    'color-text-primary',
  ] as const
  const passing = steps
    .filter((name) => ratio(color(name), color(SAND)) >= 4.5)
    .sort((a, b) => luminance(color(b)) - luminance(color(a)))
  assert.ok(passing[0], 'no text token clears 4.5:1 on bg-base')
  return passing[0]
})()

/** The lowest white alpha that still clears 4.5:1 on the dark ground. */
const WHITE_FLOOR = (() => {
  const white = parseColor(token('color-text-inverse'))
  for (let a = 5; a <= 100; a += 5) {
    const measured = ratio(
      over({ ...white, a: a / 100 }, color(DARK)),
      color(DARK),
    )
    if (measured >= 4.5) return a
  }
  return 100
})()

/**
 * What to do about one failing class. The modifier is usually the whole problem — the colour
 * underneath it passes solid — and for a semantic colour (`text-emerald-600/80` on a "Completed"
 * timestamp) dropping it is the only correct fix, since the amber muted token would change what
 * the colour means.
 */
function replacement(hit: Hit, fg: Rgba, ground: string): string {
  const solid = ratio(over(fg, color(ground)), color(ground))
  const dropIt =
    solid >= 4.5
      ? `, or drop the modifier — ${hit.cls.replace(/\/\d+$/, '')} alone is ${round(solid)}:1`
      : ''
  return ground === SAND
    ? `use text-${MUTED.replace('color-', '')} (${round(ratio(color(MUTED), color(SAND)))}:1, a real colour and the lightest passing step)${dropIt}`
    : `use text-white/${WHITE_FLOOR} or above (the lowest passing step)${dropIt}`
}

test('every opacity-modified text class in src clears 4.5:1 (WCAG AA)', () => {
  // A scanner that matches nothing passes everything. The tree has been clean of these classes
  // since 2026-09-18, so the self-check is against a fixture, not against finding hits in src:
  // the regex must still see the shapes it was written for, and the walk must still find files.
  const fixture =
    '<p className="hover:text-white/70 text-[#78350f]/60 text-sm/6 text-emerald-600/80">'
  assert.deepEqual(
    [...fixture.matchAll(OPACITY_TEXT)]
      .filter((m) => !FONT_SIZE.test(m[1]))
      .map((m) => m[0]),
    ['text-white/70', 'text-[#78350f]/60', 'text-emerald-600/80'],
    'OPACITY_TEXT no longer matches the class shapes it exists to catch',
  )
  assert.ok(tsxSources().length > 0, 'the walk over src found no .tsx files')

  const failures: string[] = []
  for (const hit of HITS) {
    const fg = resolve(hit.value)
    if (!fg) continue // the next test owns the shapes this one cannot measure
    const { ground, measured } = bestCase(fg, hit.alpha)
    if (measured >= 4.5) continue
    failures.push(
      `${hit.file}:${hit.line}  ${hit.cls}  ${round(measured)}:1 over --${ground} (needs 4.5:1)  →  ${replacement(hit, fg, ground)}`,
    )
  }

  assert.equal(
    failures.length,
    0,
    `${failures.length} of ${HITS.length} opacity-modified text classes are below 4.5:1 on the ground they sit on. Opacity is not a text step — use the token:\n${failures.join('\n')}`,
  )
})

test('every opacity-modified text class in src is one this test can measure', () => {
  const unmeasurable = HITS.filter((hit) => !resolve(hit.value)).map(
    (hit) =>
      `${hit.file}:${hit.line}  ${hit.cls}  →  colour not resolvable from globals.css; use text-${MUTED.replace('color-', '')}, text-text-inverse, or a text-[#hex]/NN this test can measure`,
  )
  assert.equal(
    unmeasurable.length,
    0,
    `${unmeasurable.length} opacity-modified text classes name a colour that is not a token or a literal, so their contrast is unverified. Silently skipping them is the same hole as having no scanner:\n${unmeasurable.join('\n')}`,
  )
})

/**
 * Every string a .tsx file spells out, read by the TypeScript parser: plain and template
 * literals, a template's static parts joined. A regex over quotes cannot do this — an apostrophe
 * in JSX text, or two template literals with JSX between them, pairs the wrong delimiters.
 */
function stringLiterals(
  file: string,
  src: string,
): { text: string; line: number }[] {
  const sf = ts.createSourceFile(
    file,
    src,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  )
  const out: { text: string; line: number }[] = []
  const visit = (node: ts.Node) => {
    let text: string | null = null
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node))
      text = node.text
    else if (ts.isTemplateExpression(node))
      text = [
        node.head.text,
        ...node.templateSpans.map((span) => span.literal.text),
      ].join(' ')
    if (text !== null)
      out.push({
        text,
        line: sf.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      })
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

/**
 * The component half of the accent-on-tint rule above: a class string that sets
 * `bg-accent-muted` must not also set plain `text-accent` (4.16:1 on the band). Variant-prefixed
 * classes (`hover:bg-accent-muted`) are transient and not matched. A parent tint with a coral
 * child is out of reach of a string scan; the Chrome pass owns those.
 */
test('no class string pairs bg-accent-muted with text-accent', () => {
  const TINT = /(?<![\w:-])bg-accent-muted(?![\w-])/
  const CORAL = /(?<![\w:-])text-accent(?![\w-])/
  const pairs = (text: string) => TINT.test(text) && CORAL.test(text)
  const fixture = [
    '<a className="bg-accent-muted text-accent" />',
    // biome-ignore lint/suspicious/noTemplateCurlyInString: TSX source as a fixture, not a template
    "<b className={`p-2 ${on ? 'bg-accent-muted text-accent-hover' : ''}`}>Don't</b>",
    '<i className={`bg-accent-muted`} />',
    '<i className="text-accent hover:bg-accent-muted" />',
  ].join('\n')
  assert.deepEqual(
    stringLiterals('fixture.tsx', fixture)
      .filter(({ text }) => pairs(text))
      .map(({ line }) => line),
    [1],
    'the accent-on-tint scanner no longer finds exactly the pair it exists to catch',
  )
  const failures = tsxSources().flatMap(([file, src]) =>
    stringLiterals(file, src)
      .filter(({ text }) => pairs(text))
      .map(
        ({ text, line }) =>
          `${file}:${line}  ${text.trim().slice(0, 80)}  →  use text-accent-hover`,
      ),
  )
  assert.equal(
    failures.length,
    0,
    `coral text on the coral tint is below 4.5:1:\n${failures.join('\n')}`,
  )
})

/**
 * MASTER.md's first anti-pattern, enforced: no hex in a className and no raw Tailwind palette
 * colour. The Warm Sand codemod removed 1,684 `[#hex]` utilities and ~490 `amber-*` ones, and
 * the semantic pass the last ~90 emerald/red/green/yellow/blue/purple ones; every colour now
 * comes from a token, which is what lets tokenContrast measure the site at all. Inline styles in
 * the OG images, emails and global-error are not class strings and are not matched.
 */
test('no hex colour classes and no raw palette colour classes in src', () => {
  const HEX = /(?<![\w-])[\w:-]*-\[#[0-9a-fA-F]{3,8}\](?:\/\d+)?/g
  const PALETTE =
    /(?<![\w-])[\w:-]*(?:text|bg|border|ring|divide|fill|stroke|from|via|to|outline|decoration|placeholder|accent|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?(?![\w-])/g
  const fixture =
    '<p className="text-[#451a03] hover:bg-amber-800/8 text-text-muted bg-bg-surface">'
  assert.deepEqual(
    [...fixture.matchAll(HEX), ...fixture.matchAll(PALETTE)].map((m) => m[0]),
    ['text-[#451a03]', 'hover:bg-amber-800/8'],
    'the colour-class scanner no longer matches the shapes it exists to catch',
  )
  const failures = tsxSources().flatMap(([file, src]) =>
    src
      .split('\n')
      .flatMap((line, i) =>
        [...line.matchAll(HEX), ...line.matchAll(PALETTE)].map(
          (m) =>
            `${file}:${i + 1}  ${m[0]}  →  use a token utility (MASTER.md)`,
        ),
      ),
  )
  assert.equal(
    failures.length,
    0,
    `raw colour classes in src:\n${failures.join('\n')}`,
  )
})
