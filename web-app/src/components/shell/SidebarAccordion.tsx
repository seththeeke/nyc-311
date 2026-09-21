import type { ReactElement } from "react";
import { Link } from "react-router-dom";
import type { MenuLeaf, MenuSectionEntry } from "./menuConfig";
import { ROW_BASE_CLASSES, rowStateClasses } from "./SidebarLink";
import { ChevronIcon, ExternalLinkIcon, LockIcon } from "./shellIcons";

interface SidebarAccordionProps {
  section: MenuSectionEntry;
  expanded: boolean;
  collapsed: boolean;
  locked: boolean;
  pathname: string;
  onToggle: () => void;
  onNavigate: () => void;
}

interface LeafRowProps {
  leaf: MenuLeaf;
  active: boolean;
  locked: boolean;
  onNavigate: () => void;
}

const LEAF_CLASSES = `${ROW_BASE_CLASSES} py-1.5 pl-11 font-normal`;

function LeafRow({ leaf, active, locked, onNavigate }: LeafRowProps): ReactElement {
  if (leaf.external) {
    return (
      <a
        href={leaf.to}
        target="_blank"
        rel="noopener noreferrer"
        className={`${LEAF_CLASSES} ${rowStateClasses(false)}`}
      >
        <span className="truncate">{leaf.label}</span>
        <ExternalLinkIcon className="ml-auto h-3.5 w-3.5 shrink-0" />
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    );
  }
  return (
    <Link
      to={leaf.to}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      data-tooltip={locked ? `${leaf.label} — sign in required` : undefined}
      className={`${LEAF_CLASSES} ${rowStateClasses(active)}`}
    >
      <span className="truncate">{leaf.label}</span>
      {locked && (
        <>
          <LockIcon className="ml-auto h-3.5 w-3.5 shrink-0" />
          <span className="sr-only">(locked — sign in required)</span>
        </>
      )}
    </Link>
  );
}

/**
 * An accordion menu section. The header is a button (`aria-expanded`/
 * `aria-controls`); a locked section (Admin, signed out) shows a lock on the
 * header and on each item but still expands, so a visitor can see what it
 * offers. Collapsed to the rail, only the header icon shows.
 */
export function SidebarAccordion({
  section,
  expanded,
  collapsed,
  locked,
  pathname,
  onToggle,
  onNavigate,
}: SidebarAccordionProps): ReactElement {
  const Icon = section.icon;
  const panelId = `sidebar-section-${section.id}`;
  const sectionActive = expanded && !collapsed;

  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded && !collapsed}
        aria-controls={panelId}
        aria-label={collapsed ? (locked ? `${section.label} (locked)` : section.label) : undefined}
        data-tooltip={locked ? `${section.label} — sign in required` : section.label}
        className={`${ROW_BASE_CLASSES} ${rowStateClasses(false)} ${collapsed ? "justify-center px-0" : ""}`}
      >
        <Icon className="h-5 w-5 shrink-0" />
        {!collapsed && (
          <>
            <span className="truncate">{section.label}</span>
            {locked && (
              <>
                <LockIcon className="ml-auto h-4 w-4 shrink-0 text-hue-amber" />
                <span className="sr-only">(locked — sign in required)</span>
              </>
            )}
            <ChevronIcon
              className={`h-4 w-4 shrink-0 transition-transform ${locked ? "" : "ml-auto"} ${sectionActive ? "rotate-90" : ""}`}
            />
          </>
        )}
      </button>
      {sectionActive && (
        <div id={panelId} role="group" aria-label={section.label} className="mt-0.5 space-y-0.5">
          {section.items.map((leaf) => (
            <LeafRow
              key={leaf.to}
              leaf={leaf}
              active={pathname === leaf.to}
              locked={locked}
              onNavigate={onNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
