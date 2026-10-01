'use client'

import { CaretDown } from '@phosphor-icons/react'

export interface FaqItem {
  question: string
  answer: string
}

interface FaqProps {
  items: FaqItem[]
  className?: string
}

/**
 * FAQ - Accessible accordion component using semantic details/summary elements
 * Renders expandable FAQ items as a hairline list (native <details>)
 */
export function Faq({ items, className = '' }: FaqProps) {
  if (items.length === 0) return null

  return (
    <section className={className}>
      <h2 className="font-display text-xl font-bold tracking-tight text-text-primary mb-4">
        Frequently asked questions
      </h2>
      <div className="divide-y divide-border-default border-y border-border-default">
        {items.map((item) => (
          <details key={item.question} className="group">
            <summary className="flex items-center justify-between min-h-[44px] py-4 cursor-pointer list-none">
              <span className="text-text-primary font-medium pr-4">
                {item.question}
              </span>
              <CaretDown
                size={18}
                weight="bold"
                className="text-text-muted group-open:rotate-180 transition-transform flex-shrink-0"
              />
            </summary>
            <div className="pb-4 pr-8 text-text-secondary">{item.answer}</div>
          </details>
        ))}
      </div>
    </section>
  )
}
