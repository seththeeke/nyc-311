import { describe, expect, it } from "vitest";
import { Mesh, type MeshStandardMaterial } from "three";
import {
  buildBarrier,
  buildBuilding,
  buildCone,
  buildDebris,
  buildHydrant,
  buildPatch,
  buildPothole,
  buildRoller,
  buildStreetLamp,
  buildTree,
} from "../../../../src/components/mapv2/three/props";

describe("props", () => {
  it("builds every street prop as a non-empty group", () => {
    for (const prop of [buildCone(), buildBarrier(), buildPothole(), buildStreetLamp(), buildHydrant()]) {
      expect(prop.children.length).toBeGreaterThan(0);
    }
  });

  it("builds a roller with two drums", () => {
    const roller = buildRoller();
    expect(roller.drums).toHaveLength(2);
    expect(roller.root.children).toContain(roller.drums[0]);
  });

  it("scales trees and varies debris by seed", () => {
    expect(buildTree(1.5).scale.x).toBe(1.5);
    expect(buildDebris(1).rotation.y).not.toBe(buildDebris(2).rotation.y);
  });

  it("starts the asphalt patch cold (no glow)", () => {
    expect((buildPatch().material as MeshStandardMaterial).emissiveIntensity).toBe(0);
  });
});

describe("buildBuilding", () => {
  const base = { width: 9, depth: 12, color: "#8a4b3a", seed: 3 };

  function windows(group: ReturnType<typeof buildBuilding>): Mesh[] {
    return group.children.filter((c): c is Mesh => c instanceof Mesh && c.position.z > base.depth / 2 && c.position.y > 3);
  }

  it("lights a stable subset of windows, all or none at the extremes", () => {
    const allLit = windows(buildBuilding({ ...base, floors: 4, litFraction: 1 }));
    const noneLit = windows(buildBuilding({ ...base, floors: 4, litFraction: 0 }));
    expect(allLit.length).toBe(noneLit.length);
    expect(allLit.length).toBeGreaterThan(0);
    const emissive = (m: Mesh) => (m.material as MeshStandardMaterial).emissiveIntensity;
    expect(allLit.every((m) => emissive(m) > 1)).toBe(true);
    expect(noneLit.every((m) => emissive(m) === 1)).toBe(true);
  });

  it("gives a one-storey storefront no upper windows, and a narrow façade one column", () => {
    expect(windows(buildBuilding({ ...base, floors: 1, litFraction: 1 }))).toHaveLength(0);
    expect(windows(buildBuilding({ ...base, width: 1, floors: 2, litFraction: 1 }))).toHaveLength(1);
  });
});
