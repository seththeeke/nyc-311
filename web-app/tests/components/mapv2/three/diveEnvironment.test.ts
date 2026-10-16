import { describe, expect, it } from "vitest";
import { Color, Fog, PointLight, Scene } from "three";
import { buildDiveEnvironment, MOODS } from "../../../../src/components/mapv2/three/diveEnvironment";

function lamps(scene: Scene): number {
  let count = 0;
  scene.traverse((o) => {
    if (o instanceof PointLight) count += 1;
  });
  return count;
}

describe("buildDiveEnvironment", () => {
  it("builds a lamp-lit night block under DARK", () => {
    const scene = new Scene();
    buildDiveEnvironment(scene, "DARK");
    expect((scene.background as Color).getHexString()).toBe(MOODS.DARK.sky.slice(1));
    expect(scene.fog).toBeInstanceOf(Fog);
    expect(lamps(scene)).toBe(4);
  });

  it("builds a daylit block with the street lamps off under LIGHT", () => {
    const scene = new Scene();
    buildDiveEnvironment(scene, "LIGHT");
    expect(lamps(scene)).toBe(0);
    expect(scene.children.length).toBeGreaterThan(3);
  });
});
