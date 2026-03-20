import {
  MagnifyingGlass,
  Scales,
  PiggyBank,
} from '@phosphor-icons/react/dist/ssr'

const steps = [
  {
    icon: MagnifyingGlass,
    step: '01',
    title: 'Browse',
    description:
      'Search by treatment or city. See real prices from real providers — no hidden fees.',
  },
  {
    icon: Scales,
    step: '02',
    title: 'Compare',
    description:
      'Side-by-side pricing so you can spot the best value. Filter by category, location, or price.',
  },
  {
    icon: PiggyBank,
    step: '03',
    title: 'Save',
    description:
      'Claim deals directly. Save 20-60% compared to standard pricing at top medspas.',
  },
]

export function ValuePropsSection() {
  return (
    <section className="py-16 sm:py-20">
      <div className="text-center mb-12">
        <h2 className="text-2xl font-bold text-[#451a03]">How it works</h2>
        <p className="text-[#78350f] mt-2">
          Three steps to better prices
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {steps.map((item) => (
          <div
            key={item.step}
            className="bg-[#f2ebe2] border border-[#d4c4b0] rounded-[10px] p-6 text-center"
          >
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-amber-800/8 border border-amber-800/15 mb-4">
              <item.icon
                size={24}
                weight="duotone"
                className="text-amber-800"
              />
            </div>
            <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-2">
              Step {item.step}
            </div>
            <h3 className="font-semibold text-[#451a03] text-lg mb-2">
              {item.title}
            </h3>
            <p className="text-sm text-[#78350f] leading-relaxed">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
