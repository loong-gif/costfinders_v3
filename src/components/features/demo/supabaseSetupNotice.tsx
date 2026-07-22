import { Database, GearSix } from '@phosphor-icons/react/dist/ssr'
import { missingSupabaseVariables } from '@/lib/supabase-config'

export function SupabaseSetupNotice() {
  return (
    <main className="min-h-screen px-4 pb-20 pt-28 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-2xl rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-6 shadow-[var(--shadow-md)] sm:p-8">
        <div className="mb-5 flex size-12 items-center justify-center rounded-xl bg-[var(--color-accent-muted)] text-[var(--color-accent)]">
          <Database aria-hidden="true" size={26} weight="fill" />
        </div>
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-[var(--color-text-muted)]">
          Local demo setup
        </p>
        <h1 className="text-3xl font-bold text-[var(--color-text-primary)]">
          Connect Supabase to view live deals
        </h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          This demo uses the existing CostFinders Supabase project. Add the
          public project credentials to <code>frontend/.env.local</code>, then
          restart the development server.
        </p>

        <div className="mt-6 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[var(--color-text-primary)]">
            <GearSix aria-hidden="true" size={18} weight="bold" />
            Missing environment variables
          </div>
          <ul className="mt-3 space-y-2 font-mono text-sm text-[var(--color-text-secondary)]">
            {missingSupabaseVariables.map((variable) => (
              <li key={variable}>{variable}</li>
            ))}
          </ul>
        </div>

        <pre className="mt-6 overflow-x-auto rounded-xl bg-[var(--color-bg-inverted)] p-4 text-sm leading-6 text-[var(--color-text-on-dark)]">
          <code>{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key`}</code>
        </pre>
      </section>
    </main>
  )
}
