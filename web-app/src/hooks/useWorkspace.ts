import { createContext, useContext } from "react";
import type { WidgetId } from "../models/widget";

export interface WorkspaceContextValue {
  secondaryWidgetIds: readonly WidgetId[];
  setSecondaryWidgets: (ids: readonly WidgetId[]) => void;
  addSecondaryWidget: (id: WidgetId) => void;
  removeSecondaryWidget: (id: WidgetId) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("useWorkspace must be used inside a WorkspaceProvider");
  return value;
}
