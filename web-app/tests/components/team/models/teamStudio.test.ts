import { ACESFilmicToneMapping, BoxGeometry, Group, Mesh, NoToneMapping, Scene, Texture, type WebGLRenderer } from "three";
import { describe, expect, it, vi } from "vitest";

const pmrem = vi.hoisted(() => ({ made: 0 }));

vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class FakePmrem {
    constructor() {
      pmrem.made += 1;
    }
    fromScene(): { texture: Texture } {
      return { texture: new actual.Texture() };
    }
    dispose(): void {}
  }
  return { ...actual, PMREMGenerator: FakePmrem };
});
vi.mock("three/examples/jsm/environments/RoomEnvironment.js", async () => ({ RoomEnvironment: (await import("three")).Scene }));

import { TEAM_MODELS } from "../../../../src/components/team/models/teamModels";
import { applyFilmicTone, teamFullBodyCamera, teamPortraitCamera, teamStudio } from "../../../../src/components/team/models/teamStudio";

describe("teamStudio", () => {
  it("lights the scene with an environment map, made once per renderer", () => {
    const renderer = {} as WebGLRenderer;
    const scene = teamStudio(renderer);
    expect(scene).toBeInstanceOf(Scene);
    expect(scene.environment).toBeInstanceOf(Texture);
    expect(scene.children.length).toBe(4);
    teamStudio(renderer);
    expect(pmrem.made).toBe(1);
  });

  it("switches filmic tone mapping on, and back off", () => {
    const renderer = { toneMapping: NoToneMapping, toneMappingExposure: 1 } as WebGLRenderer;
    const restore = applyFilmicTone(renderer);
    expect(renderer.toneMapping).toBe(ACESFilmicToneMapping);
    restore();
    expect(renderer.toneMapping).toBe(NoToneMapping);
  });

  it("frames the head for the avatar and the whole figure for the stage", () => {
    const rig = TEAM_MODELS["fergus-farthing"]();
    const portrait = teamPortraitCamera(rig);
    const full = teamFullBodyCamera(rig, 0.75);
    expect(portrait.position.x).toBeGreaterThan(0.5);
    expect(full.position.x).toBeGreaterThan(portrait.position.x);
    expect(full.aspect).toBe(0.75);
  });

  it("frames a figure with no performance from its rest pose alone, ignoring effects", () => {
    const rig = TEAM_MODELS["fergus-farthing"]();
    const still = teamFullBodyCamera(rig, 0.75);
    rig.cycle = undefined;
    const fx = new Group();
    fx.userData.fx = true;
    fx.add(new Mesh(new BoxGeometry(50, 50, 50)));
    rig.root.add(fx);
    const rest = teamFullBodyCamera(rig, 0.75);
    expect(rest.position.x).toBeGreaterThan(0.5);
    expect(rest.position.x).toBeLessThanOrEqual(still.position.x);
  });
});
