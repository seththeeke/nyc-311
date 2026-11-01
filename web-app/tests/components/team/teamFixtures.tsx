import type { ReactElement } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";

/* Shared helpers for the Meet the Team component tests. */
export function LocationProbe(): ReactElement {
  return <output aria-label="search">{useLocation().search}</output>;
}

export function inRouter(ui: ReactElement, path = "/team"): ReactElement {
  return (
    <MemoryRouter initialEntries={[path]}>
      {ui}
      <LocationProbe />
    </MemoryRouter>
  );
}
