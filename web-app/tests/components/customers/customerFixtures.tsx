import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";

/* Shared helpers for the Customers component tests. */

/** Prints the current query string so a test can assert on what a click selected. */
export function LocationProbe(): ReactElement {
  return <output aria-label="search">{useLocation().search}</output>;
}

export function inRouter(ui: ReactElement, path = "/customers"): ReactElement {
  return (
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );
}
