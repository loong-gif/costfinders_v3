'use client'

/**
 * WCAG 2.4.1 bypass block. Both site headers render this first, so it is the
 * first thing a keyboard user reaches on every page — ahead of the logo, the
 * auth controls and, on the dashboards, up to nine icon-rail links.
 *
 * It moves focus to the page's <main> rather than linking to `#main`, because
 * <main> lives in 30 different route and feature files and none of them carries
 * an id. A button that finds the landmark works on all of them, and on any page
 * added later, without an id to remember.
 *
 * ponytail: needs JS, which an in-page anchor would not. If a no-JS bypass is
 * ever wanted, give every <main> `id="main"` and swap this for an <a href>.
 */
export function SkipToContent() {
  const handleSkip = () => {
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return
    // <main> is not focusable on its own; -1 lets it receive programmatic
    // focus without joining the tab order. globals.css suppresses the focus
    // ring on it, since a ring around the whole page reads as a bug.
    main.setAttribute('tabindex', '-1')
    main.focus()
    main.scrollIntoView()
  }

  return (
    <button type="button" onClick={handleSkip} className="skip-link">
      Skip to content
    </button>
  )
}
