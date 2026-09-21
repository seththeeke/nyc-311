import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { WorkspaceProvider } from "../../../src/components/shell/WorkspaceProvider";
import { useWorkspace } from "../../../src/hooks/useWorkspace";
import { DEFAULT_SECONDARY_WIDGET_IDS } from "../../../src/components/widgets/widgetRegistry";

function wrapper({ children }: { children: ReactNode }) {
  return <WorkspaceProvider>{children}</WorkspaceProvider>;
}

describe("WorkspaceProvider / useWorkspace", () => {
  it("starts from the default secondary widget list", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    expect(result.current.secondaryWidgetIds).toEqual(DEFAULT_SECONDARY_WIDGET_IDS);
  });

  it("accepts an initial list override", () => {
    const { result } = renderHook(() => useWorkspace(), {
      wrapper: ({ children }: { children: ReactNode }) => (
        <WorkspaceProvider initialSecondaryWidgetIds={["CAPACITY"]}>{children}</WorkspaceProvider>
      ),
    });
    expect(result.current.secondaryWidgetIds).toEqual(["CAPACITY"]);
  });

  it("adds a widget once and ignores duplicates", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => result.current.setSecondaryWidgets(["CAPACITY"]));
    act(() => result.current.addSecondaryWidget("SERVICED"));
    act(() => result.current.addSecondaryWidget("SERVICED"));
    expect(result.current.secondaryWidgetIds).toEqual(["CAPACITY", "SERVICED"]);
  });

  it("removes a widget", () => {
    const { result } = renderHook(() => useWorkspace(), { wrapper });
    act(() => result.current.removeSecondaryWidget("CAPACITY"));
    expect(result.current.secondaryWidgetIds).not.toContain("CAPACITY");
  });

  it("throws outside a provider", () => {
    expect(() => renderHook(() => useWorkspace())).toThrow(/WorkspaceProvider/);
  });
});
