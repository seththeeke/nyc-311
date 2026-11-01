import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/components/team/useTeamStage", () => ({ useTeamStage: vi.fn() }));

import TeamStage from "../../../src/components/team/TeamStage";
import { useTeamStage } from "../../../src/components/team/useTeamStage";

afterEach(() => vi.unstubAllGlobals());

describe("TeamStage", () => {
  it("is a labelled canvas running the member's model, honouring reduced motion", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({ matches: query.includes("reduce") }));
    render(<TeamStage name="Penny Platen" modelKey="penny-platen" />);
    expect(screen.getByRole("img", { name: "Penny Platen, performing. Drag to turn." }).tagName).toBe("CANVAS");
    expect(vi.mocked(useTeamStage).mock.calls[0].slice(1)).toEqual(["penny-platen", true]);
  });

  it("animates when the browser cannot say", () => {
    vi.stubGlobal("matchMedia", undefined);
    render(<TeamStage name="Rex Rivet" modelKey="rex-rivet" />);
    expect(vi.mocked(useTeamStage).mock.lastCall?.[2]).toBe(false);
  });
});
