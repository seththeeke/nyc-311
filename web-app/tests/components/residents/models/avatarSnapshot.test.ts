import { afterEach, describe, expect, it, vi } from "vitest";

const rendered = vi.hoisted(() => ({ calls: 0, created: 0 }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakeRenderer {
    domElement = { toDataURL: () => "data:image/png;base64,AVATAR" };
    constructor() {
      rendered.created += 1;
    }
    setPixelRatio(): void {}
    setSize(): void {}
    setClearColor(): void {}
    render(): void {
      rendered.calls += 1;
    }
  }
  return { ...actual, WebGLRenderer: FakeRenderer };
});

vi.mock("../../../../src/components/team/models/teamPortrait", () => ({ photographTeamMember: () => "data:image/png;base64,TEAM" }));

import { renderResidentAvatar } from "../../../../src/components/residents/models/avatarSnapshot";

afterEach(() => {
  rendered.calls = 0;
});

describe("renderResidentAvatar", () => {
  it("photographs a resident with one shared renderer and returns a data URL", () => {
    expect(renderResidentAvatar("hawthorn")).toBe("data:image/png;base64,AVATAR");
    expect(renderResidentAvatar("juniper")).toBe("data:image/png;base64,AVATAR");
    expect(rendered.calls).toBe(2);
    expect(rendered.created).toBe(1);
  });

  it("hands an executive's key to the team studio", () => {
    expect(renderResidentAvatar("penny-platen")).toBe("data:image/png;base64,TEAM");
    expect(rendered.calls).toBe(0);
  });

  it("returns null for a key with no model, without rendering", () => {
    expect(renderResidentAvatar("oak")).toBeNull();
    expect(rendered.calls).toBe(0);
  });
});
