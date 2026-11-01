import { Scene, type WebGLRenderer } from "three";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../src/components/team/models/teamStudio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../../src/components/team/models/teamStudio")>();
  return { ...actual, teamStudio: () => new Scene() };
});

import { photographTeamMember } from "../../../../src/components/team/models/teamPortrait";

describe("photographTeamMember", () => {
  it("renders the executive in the team studio with filmic tone, then puts the renderer back", () => {
    const render = vi.fn();
    const renderer = { render, toneMapping: 0, toneMappingExposure: 1, domElement: { toDataURL: () => "data:image/png;base64,TEAM" } } as unknown as WebGLRenderer;
    expect(photographTeamMember(renderer, "kid-kestrel")).toBe("data:image/png;base64,TEAM");
    expect(render).toHaveBeenCalledTimes(1);
    expect(renderer.toneMapping).toBe(0);
  });
});
