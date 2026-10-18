import type { ReactElement } from "react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../../hooks/useWorkspace";
import { WidgetSlot } from "../widgets/WidgetSlot";
import { secondaryContentFor } from "./secondaryContent";
import { SecondaryToggleIcon } from "./shellIcons";

interface SecondaryWorkspaceProps {
  onCollapse: () => void;
}

/**
 * The thin right panel — present on every route. By default it shows
 * workspace state (a list of widget ids, 12-UX-workspace-refactor.md
 * §4.2) through `WidgetSlot`, two tiles per row; a route listed in
 * `secondaryContent` (the Residents page) supplies its own content instead.
 */
export function SecondaryWorkspace({ onCollapse }: SecondaryWorkspaceProps): ReactElement {
  const { secondaryWidgetIds } = useWorkspace();
  const RouteContent = secondaryContentFor(useLocation().pathname);

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
      {RouteContent ? (
        <div className="flex-1 overflow-y-auto">
          <RouteContent />
        </div>
      ) : (
        <div className="grid flex-1 grid-cols-2 content-start gap-2 overflow-y-auto px-3 pb-3">
          {secondaryWidgetIds.map((id) => (
            <WidgetSlot key={id} widgetId={id} size="TILE" />
          ))}
        </div>
      )}
    </aside>
  );
}
