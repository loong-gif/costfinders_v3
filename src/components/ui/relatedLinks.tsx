import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'

export interface RelatedLink {
  label: string
  href: string
  description?: string
}

interface RelatedLinksProps {
  title: string
  links: RelatedLink[]
  className?: string
}

/**
 * RelatedLinks - Cross-navigation component for SEO internal linking
 * Renders a titled section with links to related pages
 */
export function RelatedLinks({ title, links, className = '' }: RelatedLinksProps) {
  if (links.length === 0) return null

  return (
    <section className={`${className}`}>
      <h2 className="text-lg font-semibold text-stone-100 mb-4">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between p-4 bg-stone-900 border border-stone-800 rounded-xl hover:border-amber-400/50 transition-colors"
          >
            <div>
              <span className="text-stone-100 font-medium group-hover:text-amber-400 transition-colors">
                {link.label}
              </span>
              {link.description && (
                <p className="text-sm text-stone-500 mt-1">{link.description}</p>
              )}
            </div>
            <ArrowRight
              size={16}
              weight="bold"
              className="text-stone-500 group-hover:text-amber-400 transition-colors flex-shrink-0 ml-2"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
