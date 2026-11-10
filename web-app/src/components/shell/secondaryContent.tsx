import { lazy, type ComponentType } from "react";
import { matchPath } from "react-router-dom";
import { CONTACTS_PATH } from "../contacts/contactRoutes";
import { CONTACT_PARAM } from "../../hooks/useContactSelection";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH } from "../residents/residentRoutes";
import { TEAM_CHAT_PATH, TEAM_PATH } from "../team/teamRoutes";

/*
 * Each panel is lazy, like the pages in AppRoutes: the shell imports this file
 * on every route, so a static import put every panel (and Team Chat's
 * react-markdown) in the entry chunk, pushing it past 500 kB (#207).
 */
const PersonaPanel = lazy(() => import("../residents/PersonaPanel").then((m) => ({ default: m.PersonaPanel })));
const ContactDetailPanel = lazy(() =>
  import("../contacts/ContactDetailPanel").then((m) => ({ default: m.ContactDetailPanel }))
);
const ResidentDetailPanel = lazy(() =>
  import("../residents/ResidentDetailPanel").then((m) => ({ default: m.ResidentDetailPanel }))
);
const ContributionsPanel = lazy(() =>
  import("../team/ContributionsPanel").then((m) => ({ default: m.ContributionsPanel }))
);
const ChatSidePanel = lazy(() => import("../team/chat/ChatSidePanel").then((m) => ({ default: m.ChatSidePanel })));

/*
 * Routes that drive the secondary workspace with their own content
 * (13-customer-simulation.md §4) instead of the default widget tiles.
 * Matched in order as whole route patterns; any route not listed keeps
 * the widgets.
 */
const SECONDARY_CONTENT: [string, ComponentType][] = [
  [RESIDENTS_PATH, PersonaPanel],
  [CONTACTS_PATH, ContactDetailPanel],
  [IDEA_DETAIL_PATTERN, ResidentDetailPanel],
  [TEAM_PATH, ContributionsPanel],
  [TEAM_CHAT_PATH, ChatSidePanel],
];

/** The component a route puts in the secondary workspace, or `null` for the default widgets. */
export function secondaryContentFor(pathname: string): ComponentType | null {
  return SECONDARY_CONTENT.find(([pattern]) => matchPath(pattern, pathname))?.[1] ?? null;
}

/** Pages that start with the secondary workspace closed (#146): Contacts until a contact is open, Meet the Team until someone's contributions are open, Team Chat until a thread or a profile is. */
export function secondaryStartsClosed(pathname: string, search: string): boolean {
  const params = new URLSearchParams(search);
  if (matchPath(CONTACTS_PATH, pathname)) return !params.has(CONTACT_PARAM);
  if (matchPath(TEAM_PATH, pathname)) return !params.has("contributions");
  return !!matchPath(TEAM_CHAT_PATH, pathname) && !params.has("thread") && !params.has("profile");
}
