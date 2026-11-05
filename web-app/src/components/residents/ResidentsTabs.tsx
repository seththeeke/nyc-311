import type { ReactElement } from "react";
import { NavLink } from "react-router-dom";
import { useFeatureEnabled } from "../../hooks/useFeatureTreatment";
import { CONTACTS_PAGE_FLAG, CONTACTS_PAGE_ON } from "../../models/featureTreatment";
import { CONTACTS_PATH, RESIDENTS_PATH } from "./residentRoutes";

const TABS = [
  { to: RESIDENTS_PATH, label: "Residents" },
  { to: CONTACTS_PATH, label: "Contacts" },
] as const;

/** The Residents section's tabs; shown only while CONTACTS_PAGE is on, since Residents is the only tab otherwise. */
export function ResidentsTabs(): ReactElement | null {
  const enabled = useFeatureEnabled(CONTACTS_PAGE_FLAG, CONTACTS_PAGE_ON);
  if (!enabled) return null;
  return (
    <nav aria-label="Residents sections" className="mb-6 flex gap-1 border-b border-line">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end
          className={({ isActive }) =>
            `-mb-px border-b-2 px-3 py-2 text-sm font-medium ${isActive ? "border-hue-indigo text-fg" : "border-transparent text-fg-muted hover:text-fg"}`
          }
        >
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
