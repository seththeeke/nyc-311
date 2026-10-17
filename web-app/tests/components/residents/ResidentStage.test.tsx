import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/components/residents/useResidentStage", () => ({ useResidentStage: vi.fn() }));

import ResidentStage from "../../../src/components/residents/ResidentStage";
import { useResidentStage } from "../../../src/components/residents/useResidentStage";

afterEach(() => vi.unstubAllGlobals());

describe("ResidentStage", () => {
  it("is a labelled canvas running the resident's model, honouring reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    render(<ResidentStage name="Juniper" modelKey="juniper" />);
    expect(screen.getByRole("img", { name: "Juniper, waving" }).tagName).toBe("CANVAS");
    expect(vi.mocked(useResidentStage).mock.calls[0].slice(1)).toEqual(["juniper", true]);
  });

  it("animates when the browser cannot say", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<ResidentStage name="Hawthorn" modelKey="hawthorn" />);
    expect(vi.mocked(useResidentStage).mock.lastCall?.[2]).toBe(false);
  });
});
