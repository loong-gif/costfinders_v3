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
      <h2 className="text-2xl font-bold text-[#451a03] mb-6">
        Frequently asked questions about {treatmentLabel.toLowerCase()} in{' '}
        {cityLabel}
      </h2>

      <div className="space-y-3">
        {faqs.map((faq) => (
          <details
            key={faq.question}
            className="group bg-[#faf5ee] border border-[#d4c4b0] rounded-xl overflow-hidden"
          >
            <summary className="flex items-center justify-between gap-4 p-5 cursor-pointer list-none text-[#451a03] font-medium hover:bg-[#f2ebe2] transition-colors">
              <span>{faq.question}</span>
              <CaretDown
                size={18}
                weight="bold"
                className="shrink-0 text-[#78350f]/60 group-open:rotate-180 transition-transform"
              />
            </summary>
            <div className="px-5 pb-5 text-sm text-[#78350f]/80 leading-relaxed">
              {faq.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  )
}
