import { APP_STATUS } from "@/lib/status";

/**
 * Placeholder home screen. FRE-2 only promises a reachable URL - the real
 * product UI arrives with the app shell and the first vertical slice.
 */
export default function Home() {
  return (
    <main className="safe-top safe-bottom flex flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div className="flex flex-col gap-2">
        <p className="text-muted text-sm font-medium tracking-widest uppercase">
          Freddy Corp
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">The foundation is up.</h1>
        <p className="text-muted text-base">{APP_STATUS.tagline}</p>
      </div>

      <dl className="border-border bg-border grid grid-cols-1 gap-px overflow-hidden rounded-xl border text-sm">
        {APP_STATUS.facts.map((fact) => (
          <div
            key={fact.label}
            className="bg-surface flex items-baseline justify-between gap-4 px-4 py-3"
          >
            <dt className="text-muted">{fact.label}</dt>
            <dd className="text-right font-medium">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-muted text-xs">
        Next up: auth and per-user data isolation, then the first thing you can actually
        manage.
      </p>
    </main>
  );
}
