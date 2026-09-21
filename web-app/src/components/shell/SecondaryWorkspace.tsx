import type { ReactElement } from "react";
import { useWorkspace } from "../../hooks/useWorkspace";
import { WidgetSlot } from "../widgets/WidgetSlot";
import { SecondaryToggleIcon } from "./shellIcons";

interface SecondaryWorkspaceProps {
  onCollapse: () => void;
}

/**
 * The thin right panel — present on every route and driven by workspace
 * state (a list of widget ids), not by the route or menu selection
 * (12-UX-workspace-refactor.md §4.2). It only renders ids through
 * `WidgetSlot`; it has no idea which widgets exist. Tiles sit two per row.
 */
export function SecondaryWorkspace({ onCollapse }: SecondaryWorkspaceProps): ReactElement {
  const { secondaryWidgetIds } = useWorkspace();

  return (
    <aside aria-label="Secondary workspace" className="flex h-full w-80 shrink-0 flex-col border-l border-line bg-panel-sunken">
      <div className="flex justify-end p-2">
        <button
          type="button"
          onClick={onCollapse}
          aria-label="Hide secondary panel"
          className="rounded-lg p-1.5 text-fg-subtle hover:bg-panel-hover hover:text-fg"
        >
          <SecondaryToggleIcon />
        </button>
      </div>
      <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto px-3 pb-3">
        {secondaryWidgetIds.map((id) => (
          <WidgetSlot key={id} widgetId={id} size="TILE" />
        ))}
      </div>
    </aside>
  );
}
