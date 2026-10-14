import type { ReactElement } from "react";
import { IdeaFeed } from "../customers/IdeaFeed";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

/**
 * The Customers page (`13-customer-simulation.md` §4), behind the
 * `CUSTOMERS_TAB` flag: the simulated customers' ideas in the primary
 * workspace, the personas themselves in the secondary one. A mock to
 * settle the experience and the API it needs — the data is sample data
 * until the customer read API exists.
 */
export function CustomersPage(): ReactElement {
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <header className="mb-6">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold text-fg">Customers</h1>
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-hue-amber ring-1 ring-amber-400/30">
            PREVIEW
          </span>
        </div>
        <p className="mt-1 text-sm text-fg-muted">
          What the simulated New Yorkers following their 311 complaints want from the bureau. Pick a persona on the right, an
          order, or a kind of need to narrow the feed.
        </p>
      </header>
      <IdeaFeed />
    </main>
  );
}
