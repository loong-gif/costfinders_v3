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
 * Renders expandable FAQ items with warm stone styling
 */
export function Faq({ items, className = '' }: FaqProps) {
  if (items.length === 0) return null

  return (
    <section className={className}>
      <h2 className="text-lg font-semibold text-stone-100 mb-4">
        Frequently Asked Questions
      </h2>
      <div className="space-y-3">
        {items.map((item, index) => (
          <details
            key={index}
            className="group bg-stone-900 border border-stone-800 rounded-xl overflow-hidden"
          >
            <summary className="flex items-center justify-between p-4 cursor-pointer list-none hover:bg-white/5 transition-colors">
              <span className="text-stone-100 font-medium pr-4">
                {item.question}
              </span>
              <CaretDown
                size={18}
                weight="bold"
                className="text-stone-500 group-open:rotate-180 transition-transform flex-shrink-0"
              />
            </summary>
            <div className="px-4 pb-4 text-stone-400">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
