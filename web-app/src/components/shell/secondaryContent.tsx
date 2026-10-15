import type { ComponentType } from "react";
import { PersonaPanel } from "../customers/PersonaPanel";

/*
 * Routes that drive the secondary workspace with their own content
 * (13-customer-simulation.md §4) instead of the default widget tiles.
 * Exact paths only; any route not listed keeps the widgets.
 */
const SECONDARY_CONTENT: Record<string, ComponentType> = {
  "/customers": PersonaPanel,
};

/** The component a route puts in the secondary workspace, or `null` for the default widgets. */
export function secondaryContentFor(pathname: string): ComponentType | null {
  return SECONDARY_CONTENT[pathname] ?? null;
}
