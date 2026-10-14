import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { useCustomerSelection } from "../../src/hooks/useCustomerSelection";

function setup(initial = "/customers") {
  const wrapper = ({ children }: { children: ReactNode }) => <MemoryRouter initialEntries={[initial]}>{children}</MemoryRouter>;
  return renderHook(() => ({ selection: useCustomerSelection(), search: useLocation().search }), { wrapper });
}

describe("useCustomerSelection", () => {
  it("reads every part of the selection from the URL, ignoring an unknown idea type", () => {
    const { result } = setup("/customers?persona=hawthorn&order=O1&type=ESCALATION&idea=I1");
    expect(result.current.selection).toMatchObject({ personaId: "hawthorn", orderId: "O1", ideaType: "ESCALATION", ideaId: "I1" });
    expect(setup("/customers?type=NONSENSE").result.current.selection.ideaType).toBeNull();
  });

  it("starts a fresh view of a newly picked persona, keeping the type filter", () => {
    const { result } = setup("/customers?order=O1&idea=I1&type=ETA_REQUEST");
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

  it("toggles one expanded idea at a time", () => {
    const { result } = setup();
    act(() => result.current.selection.toggleIdea("I1"));
    expect(result.current.selection.ideaId).toBe("I1");
    act(() => result.current.selection.toggleIdea("I2"));
    expect(result.current.selection.ideaId).toBe("I2");
    act(() => result.current.selection.toggleIdea("I2"));
    expect(result.current.selection.ideaId).toBeNull();
  });

  it("clears everything at once", () => {
    const { result } = setup("/customers?persona=hawthorn&order=O1&type=ESCALATION&idea=I1");
    act(() => result.current.selection.clearAll());
    expect(result.current.search).toBe("");
  });
});
