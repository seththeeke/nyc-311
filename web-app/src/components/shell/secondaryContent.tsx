import type { ComponentType } from "react";
import { matchPath } from "react-router-dom";
import { PersonaPanel } from "../residents/PersonaPanel";
import { ResidentDetailPanel } from "../residents/ResidentDetailPanel";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH } from "../residents/residentRoutes";
import { ThreadPanel } from "../team/chat/ThreadPanel";
import { ContributionsPanel } from "../team/ContributionsPanel";
import { TEAM_CHAT_PATH, TEAM_PATH } from "../team/teamRoutes";

/*
 * Routes that drive the secondary workspace with their own content
 * (13-customer-simulation.md §4) instead of the default widget tiles.
 * Matched in order as whole route patterns; any route not listed keeps
 * the widgets.
 */
const SECONDARY_CONTENT: [string, ComponentType][] = [
  [RESIDENTS_PATH, PersonaPanel],
  [IDEA_DETAIL_PATTERN, ResidentDetailPanel],
  [TEAM_PATH, ContributionsPanel],
  [TEAM_CHAT_PATH, ThreadPanel],
];

/** The component a route puts in the secondary workspace, or `null` for the default widgets. */
export function secondaryContentFor(pathname: string): ComponentType | null {
  return SECONDARY_CONTENT.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? null;
}

/** Pages that start with the secondary workspace closed (#146): Meet the Team until someone's contributions are open, Team Chat until a thread is. */
export function secondaryStartsClosed(pathname: string, search: string): boolean {
  const params = new URLSearchParams(search);
  if (matchPath(TEAM_PATH, pathname)) return !params.has("contributions");
  return !!matchPath(TEAM_CHAT_PATH, pathname) && !params.has("thread");
}
