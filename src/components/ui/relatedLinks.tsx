import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import Link from 'next/link'

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
export function RelatedLinks({
  title,
  links,
  className = '',
}: RelatedLinksProps) {
  if (links.length === 0) return null

  return (
    <section className={`${className}`}>
      <h2 className="font-display text-xl font-bold tracking-tight text-text-primary mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="group flex items-center justify-between p-4 bg-bg-elevated border border-border-default rounded-xl hover:border-border-hover hover:shadow-md transition-all"
          >
            <div>
              <span className="text-text-primary font-medium group-hover:text-accent transition-colors">
                {link.label}
              </span>
              {link.description && (
                <p className="text-sm text-text-muted mt-1">
                  {link.description}
                </p>
              )}
            </div>
            <ArrowRight
              size={16}
              weight="bold"
              className="text-text-muted group-hover:text-accent transition-colors flex-shrink-0 ml-2"
            />
          </Link>
        ))}
      </div>
    </section>
  )
}
