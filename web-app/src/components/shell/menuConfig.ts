import type { ComponentType } from "react";
import type { IconProps } from "../icons";
import { CONTACTS_PAGE_FLAG, CONTACTS_PAGE_ON, MEET_THE_TEAM_FLAG, MEET_THE_TEAM_ON } from "../../models/featureTreatment";
import { CONTACTS_PATH } from "../contacts/contactRoutes";
import { MAP_PATH } from "../map/mapRoutes";
import { RESIDENTS_PATH } from "../residents/residentRoutes";
import { TEAM_CHAT_PATH, TEAM_PATH } from "../team/teamRoutes";
import {
  ABOUT_PATH,
  ADMIN_CAPACITY_PATH,
  ADMIN_FEATURE_FLAGS_PATH,
  ADMIN_PATH,
  ADMIN_WAREHOUSE_PATH,
  DATA_PATH,
  MONITORING_CODE_QUALITY_PATH,
  MONITORING_INGESTION_PATH,
  MONITORING_INTEGRATION_TESTS_PATH,
  MONITORING_LAMBDA_HEALTH_PATH,
  MONITORING_PATH,
  MONITORING_PIPELINE_PATH,
  MONITORING_PUBLIC_API_PATH,
} from "../../routes/pagePaths";
import { AdminIcon, ChatIcon, ContactsIcon, MapIcon, MonitorIcon, ResidentsIcon, TeamIcon } from "./shellIcons";

/*
 * The sidebar's primary entries (12-UX-workspace-refactor.md §3.2),
 * data-driven so the menu isn't inlined in JSX. `external` leaves aren't SPA
 * routes (the coverage report is separately hosted static HTML), so they open
 * in a new tab instead of routing inside the shell.
 */
export interface MenuLeaf {
  label: string;
  to: string;
  external?: boolean;
}

/** How a flag gates a link: it appears only on the `showOn` treatments (loading, missing and failed flags read as off). */
export interface MenuFlagRule {
  key: string;
  showOn: readonly string[];
}

export interface MenuLinkEntry {
  kind: "LINK";
  id: string;
  label: string;
  to: string;
  /* Extra paths (and their sub-pages) that should also highlight this entry (e.g. /about renders the map). */
  alsoActiveOn: readonly string[];
  icon: ComponentType<IconProps>;
  /* A short tag after the label, e.g. Beta. */
  badge?: string;
  /* A `showOn` rule must match its page's flag in routes/pageTable.ts (a test checks); the menu entry alone is only a cue. */
  featureFlag?: MenuFlagRule;
}

export interface MenuSectionEntry {
  kind: "SECTION";
  id: "MONITORING" | "ADMIN";
  label: string;
  icon: ComponentType<IconProps>;
  /* The section's own landing route (/monitoring, /admin) — inside the section, though not a leaf. */
  basePath: string;
  requiresAuth: boolean;
  items: readonly MenuLeaf[];
}

export type MenuEntry = MenuLinkEntry | MenuSectionEntry;

export const MENU: readonly MenuEntry[] = [
  {
    kind: "LINK",
    id: "MAP",
    label: "Map",
    to: MAP_PATH,
    alsoActiveOn: [ABOUT_PATH, "/job"],
    icon: MapIcon,
  },
  {
    kind: "LINK",
    id: "RESIDENTS",
    label: "Residents",
    to: RESIDENTS_PATH,
    alsoActiveOn: [],
    icon: ResidentsIcon,
  },
  {
    kind: "LINK",
    id: "CONTACTS",
    label: "Contacts",
    to: CONTACTS_PATH,
    alsoActiveOn: [],
    icon: ContactsIcon,
    featureFlag: { key: CONTACTS_PAGE_FLAG, showOn: [CONTACTS_PAGE_ON] },
  },
  {
    kind: "LINK",
    id: "TEAM",
    label: "Meet the Team",
    to: TEAM_PATH,
    alsoActiveOn: [],
    icon: TeamIcon,
    featureFlag: { key: MEET_THE_TEAM_FLAG, showOn: [MEET_THE_TEAM_ON] },
  },
  {
    kind: "LINK",
    id: "TEAM_CHAT",
    label: "Team Chat",
    to: TEAM_CHAT_PATH,
    alsoActiveOn: [],
    icon: ChatIcon,
    featureFlag: { key: MEET_THE_TEAM_FLAG, showOn: [MEET_THE_TEAM_ON] },
  },
  {
    kind: "SECTION",
    id: "MONITORING",
    label: "System Monitoring",
    icon: MonitorIcon,
    basePath: MONITORING_PATH,
    requiresAuth: false,
    items: [
      { label: "311 Request Metrics", to: MONITORING_INGESTION_PATH },
      { label: "Pipeline", to: MONITORING_PIPELINE_PATH },
      { label: "Lambda Health", to: MONITORING_LAMBDA_HEALTH_PATH },
      { label: "Public API", to: MONITORING_PUBLIC_API_PATH },
      { label: "Code Quality", to: MONITORING_CODE_QUALITY_PATH },
      { label: "Test Coverage", to: "/coverage/index.html", external: true },
      { label: "Integration Tests", to: MONITORING_INTEGRATION_TESTS_PATH },
      { label: "Data Modeling", to: DATA_PATH },
    ],
  },
  {
    kind: "SECTION",
    id: "ADMIN",
    label: "Admin",
    icon: AdminIcon,
    basePath: ADMIN_PATH,
    requiresAuth: true,
    items: [
      { label: "Capacity", to: ADMIN_CAPACITY_PATH },
      { label: "Data Warehouse", to: ADMIN_WAREHOUSE_PATH },
      { label: "Feature Flags", to: ADMIN_FEATURE_FLAGS_PATH },
    ],
  },
];

/** The link, or `null` while its flag hides it (`treatment` is `undefined` while loading, `null` when missing or failed). */
export function resolveFlaggedLink(entry: MenuLinkEntry, treatment: string | null | undefined): MenuLinkEntry | null {
  const rule = entry.featureFlag;
  if (!rule) return entry;
  return treatment && rule.showOn.includes(treatment) ? entry : null;
}

function pathIsWithin(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/** True when the current route belongs to the section — used to auto-expand its accordion. */
export function sectionContainsPath(section: MenuSectionEntry, pathname: string): boolean {
  return (
    pathIsWithin(pathname, section.basePath) ||
    section.items.some((item) => !item.external && pathIsWithin(pathname, item.to))
  );
}

/** True on any monitoring/admin route — the pages that take the full width, so the shell hides the secondary panel. */
export function pathIsInAnySection(pathname: string): boolean {
  return MENU.some((entry) => entry.kind === "SECTION" && sectionContainsPath(entry, pathname));
}

/* `/` is exact (every path starts with it); any other link also stays active on its sub-pages, e.g. an Idea Detail view under /residents, unless a deeper link owns that sub-page (Team Chat under /team). */
export function linkIsActive(entry: MenuLinkEntry, pathname: string): boolean {
  if (pathname === entry.to || entry.alsoActiveOn.some((path) => pathIsWithin(pathname, path))) return true;
  if (entry.to === "/" || !pathname.startsWith(`${entry.to}/`)) return false;
  return !MENU.some((other) => other.kind === "LINK" && other.to.startsWith(`${entry.to}/`) && (pathname === other.to || pathname.startsWith(`${other.to}/`)));
}
