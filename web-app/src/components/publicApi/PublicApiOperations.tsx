import type { ReactElement } from "react";
import { PUBLIC_API_OPERATIONS } from "./publicApiOperationList";

/** Every public operation with a copy-paste example (16-resident-action-models.md §6.2). */
export function PublicApiOperations({ baseUrl }: { baseUrl: string }): ReactElement {
  return (
    <section aria-labelledby="public-api-operations" className="mt-10">
      <h2 id="public-api-operations" className="text-xl font-bold text-fg">
        Operations
      </h2>
      <p className="mt-1 text-sm text-fg-subtle">
        Base URL <code className="rounded bg-panel px-1.5 py-0.5 font-mono text-fg">{baseUrl}</code>. Every call needs an{" "}
        <code className="font-mono">X-Requester</code> header naming your client.
      </p>
      <ul className="mt-4 space-y-3">
        {PUBLIC_API_OPERATIONS.map((operation) => (
          <li key={operation.method + operation.path} className="rounded-lg border border-line bg-panel p-4">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="rounded bg-cyan-500/10 px-1.5 py-0.5 font-mono text-xs font-semibold text-hue-cyan">{operation.method}</span>
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
    </section>
  );
}
