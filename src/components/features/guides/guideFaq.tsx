import { CaretDown } from '@phosphor-icons/react/dist/ssr'
import type { GuideContent } from '@/types/guide'

interface GuideFaqProps {
  faqs: GuideContent['faqs']
  treatmentLabel: string
  cityLabel: string
}

export function GuideFaq({ faqs, treatmentLabel, cityLabel }: GuideFaqProps) {
  if (faqs.length === 0) return null

  return (
    <section className="mb-10">
      <h2 className="font-display text-2xl font-bold tracking-tight text-text-primary mb-4">
        {treatmentLabel} cost in {cityLabel}: frequently asked questions
      </h2>

      <div className="divide-y divide-border-default border-y border-border-default">
        {faqs.map((faq) => (
          <details key={faq.question} className="group">
            <summary className="flex items-center justify-between gap-4 min-h-[44px] py-4 cursor-pointer list-none text-text-primary font-medium">
              <span>{faq.question}</span>
              <CaretDown
                size={18}
                weight="bold"
                className="shrink-0 text-text-muted group-open:rotate-180 transition-transform"
              />
            </summary>
            <div className="pb-5 pr-8 text-sm text-text-secondary leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
