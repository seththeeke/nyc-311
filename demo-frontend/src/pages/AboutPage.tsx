export function AboutPage() {
  return (
    <div className="prose mx-auto min-h-[100svh] max-w-2xl px-4 pb-16 pt-24">
      <h1 className="text-xl font-semibold text-[var(--color-ink)]">About This</h1>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        <strong className="text-[var(--color-ink)]">NYC 311</strong> is a fictional field-service
        dispatch simulation built to demonstrate a realistic, production-shaped AWS architecture. It ingests real,
        public NYC 311 service requests (noise complaints, sanitation issues, illegal parking, and more) and runs
        them through a simulated dispatch workflow &mdash; scheduling crews, executing the "work," and handling
        failures the way a real ops platform would.
      </p>

      <p className="mt-3 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        No real work is performed. No real crews are dispatched. The 311 data is real; everything downstream of
        ingestion &mdash; crews, trucks, shifts, resolutions &mdash; is simulated.
      </p>

      <h2 className="mt-5 text-sm font-semibold text-[var(--color-ink)]">What you're looking at</h2>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-[var(--color-ink-soft)]">
        <li>
          <strong className="text-[var(--color-ink)]">Orders</strong> move through a workflow &mdash;{" "}
          <em>Ingest &rarr; Schedule &rarr; Execute &rarr; Resolve</em> &mdash; each stage tracked as an
          immutable event, so the current state is always a derived projection, not a mutable status field.
        </li>
        <li>
          <strong className="text-[var(--color-ink)]">The live map</strong> shows open incidents and the
          operators (trucks/crews) responding to them, animated from simulated GPS tracking pings emitted every
          couple of seconds, including each truck's predicted path to its destination.
        </li>
        <li>
          <strong className="text-[var(--color-ink)]">Cases</strong> are created when an Order's workflow fails
          in a way that needs handling &mdash; a capacity SLA breach, a workflow error, an unresolvable location.
          An AI agent investigates each one first: it either resolves the case autonomously within a bounded,
          auditable action set, or escalates it to a human admin with its reasoning attached.
        </li>
        <li>
          <strong className="text-[var(--color-ink)]">This Home view</strong> is read-only and public &mdash;
          full transparency into live incidents, crew capacity, and outcomes, no login required.
        </li>
        <li>
          <strong className="text-[var(--color-ink)]">The admin console</strong> (a quiet login icon in the
          corner, mostly for the person who built this) adds the ability to manually resolve, assign, or close
          escalated cases.
        </li>
      </ul>

      <h2 className="mt-5 text-sm font-semibold text-[var(--color-ink)]">About this prototype specifically</h2>
      <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">
        This particular screen is a throwaway UX prototype &mdash; a fast, unstructured React app used to explore
        what the real product's frontend should look like before any of it gets built against the real backend.
        All data here is generated sample data served from a mock API in your browser; nothing is persisted, and
        refreshing the page resets the simulation.
      </p>
    </div>
  );
}
