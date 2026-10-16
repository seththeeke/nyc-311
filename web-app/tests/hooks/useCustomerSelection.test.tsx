import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useCustomerSelection } from "../../src/hooks/useCustomerSelection";

function setup(initial = "/residents") {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  return renderHook(() => ({ selection: useCustomerSelection(), search: useLocation().search }), { wrapper });
}

describe("useCustomerSelection", () => {
  it("reads the selection from the URL, ignoring an unknown idea type", () => {
    const { result } = setup("/residents?persona=hawthorn&order=O1&type=ESCALATION");
    expect(result.current.selection).toMatchObject({ personaId: "hawthorn", orderId: "O1", ideaType: "ESCALATION" });
    expect(setup("/residents?type=NONSENSE").result.current.selection.ideaType).toBeNull();
  });

  it("starts a fresh view of a newly picked resident, keeping the type filter", () => {
    const { result } = setup("/residents?order=O1&type=ETA_REQUEST");
    act(() => result.current.selection.selectPersona("juniper"));
    expect(result.current.search).toBe("?type=ETA_REQUEST&persona=juniper");
  });

  it("sets and clears the order and the type", () => {
    const { result } = setup();
    act(() => result.current.selection.selectOrder("O1"));
    act(() => result.current.selection.selectIdeaType("SERVICED_CHECK"));
    expect(result.current.selection).toMatchObject({ orderId: "O1", ideaType: "SERVICED_CHECK" });
    act(() => result.current.selection.selectOrder(null));
    act(() => result.current.selection.selectIdeaType(null));
    expect(result.current.search).toBe("");
  });

  it("clears everything at once", () => {
    const { result } = setup("/residents?persona=hawthorn&order=O1&type=ESCALATION");
    act(() => result.current.selection.clearAll());
    expect(result.current.search).toBe("");
  });
});
