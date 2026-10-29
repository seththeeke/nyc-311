import type { ComponentType } from "react";
import type { IconProps } from "../icons";
import { MAP_V2_FLAG, MAP_V2_ON, MAP_V2_TAKEOVER } from "../../models/featureTreatment";
import { MAP_V2_PATH } from "../mapv2/mapV2Routes";
import { RESIDENTS_PATH } from "../residents/residentRoutes";
import { AdminIcon, CityIcon, MapIcon, MonitorIcon, ResidentsIcon } from "./shellIcons";

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

/**
 * How a flag shapes a link. With `showOn`, the link appears only on those
 * treatments (loading, missing and failed flags read as off). With
 * `hideOn`, it appears unless the flag is on one of those (loading,
 * missing and failed read as on, so nothing blinks out). `alsoActiveOnFor`
 * and `iconOn` adjust the highlighted paths and the icon per treatment.
 */
export interface MenuFlagRule {
  key: string;
  showOn?: readonly string[];
  hideOn?: readonly string[];
  alsoActiveOnFor?: Readonly<Record<string, readonly string[]>>;
  iconOn?: Readonly<Record<string, ComponentType<IconProps>>>;
}

export interface MenuLinkEntry {
  kind: "LINK";
  id: string;
  label: string;
  to: string;
  /* Extra paths that should also highlight this entry (e.g. /about renders the map). */
  alsoActiveOn: readonly string[];
  icon: ComponentType<IconProps>;
  /* A `showOn` rule needs the matching FeatureFlagRoute guard on the route; the menu entry alone is only a cue. */
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
    to: "/",
    alsoActiveOn: ["/about"],
    icon: MapIcon,
    featureFlag: { key: MAP_V2_FLAG, hideOn: [MAP_V2_TAKEOVER] },
  },
  {
    kind: "LINK",
    id: "MAP_V2",
    label: "Map",
    to: MAP_V2_PATH,
    alsoActiveOn: [],
    icon: CityIcon,
    featureFlag: {
      key: MAP_V2_FLAG,
      showOn: [MAP_V2_ON, MAP_V2_TAKEOVER],
      iconOn: { [MAP_V2_TAKEOVER]: MapIcon },
      alsoActiveOnFor: { [MAP_V2_TAKEOVER]: ["/about"] },
    },
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
    kind: "SECTION",
    id: "MONITORING",
    label: "System Monitoring",
    icon: MonitorIcon,
    basePath: "/monitoring",
    requiresAuth: false,
    items: [
      { label: "311 Request Metrics", to: "/monitoring/ingestion" },
      { label: "Pipeline", to: "/monitoring/pipeline" },
      { label: "Lambda Health", to: "/monitoring/lambda-health" },
      { label: "Test Coverage", to: "/coverage/index.html", external: true },
      { label: "Integration Tests", to: "/monitoring/integration-tests" },
      { label: "Data Modeling", to: "/data" },
    ],
  },
  {
    kind: "SECTION",
    id: "ADMIN",
    label: "Admin",
    icon: AdminIcon,
    basePath: "/admin",
    requiresAuth: true,
    items: [
      { label: "Capacity", to: "/admin/capacity" },
      { label: "Scheduling", to: "/admin/scheduling" },
      { label: "Data Warehouse", to: "/admin/warehouse" },
      { label: "Feature Flags", to: "/admin/feature-flags" },
    ],
  },
];

/**
 * The link as it should render for `treatment` (`undefined` while loading,
 * `null` when the flag is missing or failed), or `null` when it's hidden.
 */
export function resolveFlaggedLink(entry: MenuLinkEntry, treatment: string | null | undefined): MenuLinkEntry | null {
  const rule = entry.featureFlag;
  if (!rule) return entry;
  const resolved = treatment ?? null;
  const visible = rule.showOn
    ? resolved !== null && rule.showOn.includes(resolved)
    : resolved === null || !(rule.hideOn ?? []).includes(resolved);
  if (!visible) return null;
  if (resolved === null) return entry;
  return {
    ...entry,
    icon: rule.iconOn?.[resolved] ?? entry.icon,
    alsoActiveOn: [...entry.alsoActiveOn, ...(rule.alsoActiveOnFor?.[resolved] ?? [])],
  };
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

/* `/` is exact (every path starts with it); any other link also stays active on its sub-pages, e.g. an Idea Detail view under /residents. */
export function linkIsActive(entry: MenuLinkEntry, pathname: string): boolean {
  if (pathname === entry.to || entry.alsoActiveOn.includes(pathname)) return true;
  return entry.to !== "/" && pathname.startsWith(`${entry.to}/`);
}
