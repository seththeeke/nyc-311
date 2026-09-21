import { useCallback, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { WorkspaceContext, type WorkspaceContextValue } from "../../hooks/useWorkspace";
import type { WidgetId } from "../../models/widget";
import { DEFAULT_SECONDARY_WIDGET_IDS } from "../widgets/widgetRegistry";

interface WorkspaceProviderProps {
  children: ReactNode;
  initialSecondaryWidgetIds?: readonly WidgetId[];
}

/**
 * In-memory list of which widgets the secondary workspace renders. No setter
 * is wired to any UI yet (12-UX-workspace-refactor.md §4.3) — they exist so
 * "follows the menu" or "user-composed subspace" later is a data change.
 * Deliberately not persisted anywhere.
 */
export function WorkspaceProvider({
  children,
  initialSecondaryWidgetIds = DEFAULT_SECONDARY_WIDGET_IDS,
}: WorkspaceProviderProps): ReactElement {
  const [secondaryWidgetIds, setSecondaryWidgets] = useState<readonly WidgetId[]>(initialSecondaryWidgetIds);

  const addSecondaryWidget = useCallback((id: WidgetId): void => {
    setSecondaryWidgets((current) => (current.includes(id) ? current : [...current, id]));
  }, []);

  const removeSecondaryWidget = useCallback((id: WidgetId): void => {
    setSecondaryWidgets((current) => current.filter((existing) => existing !== id));
  }, []);

  const value = useMemo<WorkspaceContextValue>(
    () => ({ secondaryWidgetIds, setSecondaryWidgets, addSecondaryWidget, removeSecondaryWidget }),
    [secondaryWidgetIds, addSecondaryWidget, removeSecondaryWidget],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
