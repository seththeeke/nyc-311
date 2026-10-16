import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";
import { PersonaPanel } from "../customers/PersonaPanel";
import { ResidentDetailPanel } from "../customers/ResidentDetailPanel";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH } from "../customers/residentRoutes";

/*
 * Routes that drive the secondary workspace with their own content
 * (13-customer-simulation.md §4) instead of the default widget tiles.
 * Matched in order as whole route patterns; any route not listed keeps
 * the widgets.
 */
const SECONDARY_CONTENT: [string, ComponentType][] = [
  [RESIDENTS_PATH, PersonaPanel],
  [IDEA_DETAIL_PATTERN, ResidentDetailPanel],
];

/** The component a route puts in the secondary workspace, or `null` for the default widgets. */
export function secondaryContentFor(pathname: string): ComponentType | null {
  return SECONDARY_CONTENT.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? null;
}
