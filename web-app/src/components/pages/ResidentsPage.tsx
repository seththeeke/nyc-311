import type { ReactElement } from "react";
import { IdeaFeed } from "../residents/IdeaFeed";
import { PAGE_CONTENT_CLASSES } from "../pageLayout";

/**
 * The Residents page (`13-customer-simulation.md` §4): the simulated
 * residents' ideas in the primary workspace, the residents themselves in
 * the secondary one. A mock to settle the experience and the API it
 * needs — sample data until the resident read API exists.
 */
export function ResidentsPage(): ReactElement {
  return (
    <main className={PAGE_CONTENT_CLASSES}>
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-fg">Residents</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Simulated residents, backed by LLMs requesting support ideas to the system for the simulation to address.
        </p>
      </header>
      <IdeaFeed />
    </main>
  );
}
