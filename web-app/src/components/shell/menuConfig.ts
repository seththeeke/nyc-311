import type { ComponentType } from "react";
import type { IconProps } from "../icons";
import { AdminIcon, MapIcon, MonitorIcon } from "./shellIcons";

/*
 * The sidebar's three primary entries (12-UX-workspace-refactor.md §3.2),
 * data-driven so the menu isn't inlined in JSX. `external` leaves aren't SPA
 * routes (the coverage report is separately hosted static HTML), so they open
 * in a new tab instead of routing inside the shell.
 */
export interface MenuLeaf {
  label: string;
  to: string;
  external?: boolean;
}

export interface MenuLinkEntry {
  kind: "LINK";
  id: string;
  label: string;
  to: string;
  /* Extra paths that should also highlight this entry (e.g. /about renders the map). */
  alsoActiveOn: readonly string[];
  icon: ComponentType<IconProps>;
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
  { kind: "LINK", id: "MAP", label: "Map", to: "/", alsoActiveOn: ["/about"], icon: MapIcon },
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
    ],
  },
];

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

export function linkIsActive(entry: MenuLinkEntry, pathname: string): boolean {
  return pathname === entry.to || entry.alsoActiveOn.includes(pathname);
}
