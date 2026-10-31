import type { ReactElement } from "react";
import { PUBLIC_API_OPERATIONS } from "./publicApiOperations";

export interface PublicApiOverviewProps {
  baseUrl: string;
}

const PROMISES: { title: string; body: string }[] = [
  { title: "Stable by design", body: "Within /v1/ changes are additive only. New fields can appear; nothing you rely on disappears." },
  { title: "No keys to manage", body: "Name your client in the X-Requester header. Every response carries an X-Call-Id to quote." },
  { title: "Safe to retry", body: "Creates take an Idempotency-Key, so a retried request returns the original instead of a duplicate." },
];

/** The public API as a product (16-resident-action-models.md §6.2): what it's for and how to start. */
export function PublicApiOverview({ baseUrl }: PublicApiOverviewProps): ReactElement {
  return (
    <section aria-labelledby="public-api-overview" className="mt-8">
      <h2 id="public-api-overview" className="text-xl font-bold text-fg">
        Build on BoroughSim
      </h2>
      <p className="mt-2 max-w-3xl text-fg-muted">
        The BoroughSim public API lets anyone follow a 311 complaint through to the fix, and tell us what to build
        next. Our own residents use it every day.
      </p>
      <p className="mt-3 text-sm text-fg-subtle">
        Base URL <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-fg">{baseUrl}</code>
      </p>

      <ul className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PROMISES.map((promise) => (
          <li key={promise.title} className="rounded-lg border border-line bg-panel p-4">
            <h3 className="text-sm font-semibold text-fg">{promise.title}</h3>
            <p className="mt-1 text-sm text-fg-subtle">{promise.body}</p>
          </li>
        ))}
      </ul>

      <h3 className="mt-8 text-lg font-semibold text-fg">Operations</h3>
      <ul className="mt-3 space-y-3">
        {PUBLIC_API_OPERATIONS.map((operation) => (
          <li key={operation.path + operation.method} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-hue-cyan">
                {operation.method}
              </span>
              <code className="font-mono text-sm text-fg">{operation.path}</code>
              <span className="text-sm font-semibold text-fg">· {operation.name}</span>
            </div>
            <p className="mt-1 text-sm text-fg-subtle">{operation.summary}</p>
            <pre className="mt-3 overflow-x-auto rounded bg-surface p-3 text-xs text-fg-muted">
              <code>{operation.curl(baseUrl)}</code>
            </pre>
          </li>
        ))}
      </ul>

      <p className="mt-4 text-sm text-fg-subtle">
        Limits: 5 requests a second per API (burst 10), 1 a second for creating feature requests. Over the limit
        answers 429.
      </p>
    </section>
  );
}
