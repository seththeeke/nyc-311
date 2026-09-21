import { useState, type ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { MENU, linkIsActive, sectionContainsPath, type MenuSectionEntry } from "./menuConfig";
import { SidebarAccordion } from "./SidebarAccordion";
import { SidebarLink } from "./SidebarLink";

interface SidebarMenuProps {
  collapsed: boolean;
  onExpand: () => void;
  onNavigate: () => void;
}

/**
 * The three primary entries. Accordion open-state lives here: every section
 * starts expanded (plenty of room), and a section also re-opens when the route
 * moves inside it; the user can still close any of them.
 * The Admin lock is a UI cue only — `AdminRoute` and the API's JWT
 * authorizer remain the real enforcement.
 */
export function SidebarMenu({ collapsed, onExpand, onNavigate }: SidebarMenuProps): ReactElement {
  const { pathname } = useLocation();
  const { user, isLoading } = useAuth();
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => allSectionIds());
  const [seenPathname, setSeenPathname] = useState(pathname);

  if (seenPathname !== pathname) {
    setSeenPathname(pathname);
    const opening = MENU.filter(
      (entry): entry is MenuSectionEntry => entry.kind === "SECTION" && sectionContainsPath(entry, pathname),
    );
    if (opening.some((section) => !openIds.has(section.id))) {
      setOpenIds(new Set([...openIds, ...opening.map((section) => section.id)]));
    }
  }

  const toggle = (section: MenuSectionEntry): void => {
    if (collapsed) {
      onExpand();
      setOpenIds(new Set([...openIds, section.id]));
      return;
    }
    const next = new Set(openIds);
    if (!next.delete(section.id)) next.add(section.id);
    setOpenIds(next);
  };

  return (
    <ul className="space-y-1">
      {MENU.map((entry) =>
        entry.kind === "LINK" ? (
          <li key={entry.id}>
            <SidebarLink
              to={entry.to}
              label={entry.label}
              icon={entry.icon}
              active={linkIsActive(entry, pathname)}
              collapsed={collapsed}
              onNavigate={onNavigate}
            />
          </li>
        ) : (
          <li key={entry.id}>
            <SidebarAccordion
              section={entry}
              expanded={openIds.has(entry.id)}
              collapsed={collapsed}
              locked={entry.requiresAuth && !isLoading && !user}
              pathname={pathname}
              onToggle={() => toggle(entry)}
              onNavigate={onNavigate}
            />
          </li>
        ),
      )}
    </ul>
  );
}

function allSectionIds(): ReadonlySet<string> {
  return new Set(MENU.filter((entry) => entry.kind === "SECTION").map((entry) => entry.id));
}
