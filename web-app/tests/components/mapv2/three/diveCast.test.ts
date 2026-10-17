import { describe, expect, it } from "vitest";
import { Scene } from "three";
import { buildDiveCast, CONE_SPOTS, CUT, CUT_SIDES, SITE, TRUCK_START_X } from "../../../../src/components/mapv2/three/diveCast";

describe("buildDiveCast", () => {
  it("builds the whole cast into the scene, the truck off-screen with its map halo hidden", () => {
    const scene = new Scene();
    const cast = buildDiveCast(scene);
    expect(scene.children).toHaveLength(1);
    expect(cast.truck.root.position.x).toBe(TRUCK_START_X);
    expect(cast.truck.ground.visible).toBe(false);
    expect(cast.cones).toHaveLength(CONE_SPOTS.length);
    expect(cast.debris).toHaveLength(8);
    expect(cast.pothole.position.z).toBe(SITE.z);
  });

  it("lays the cut outline as one clockwise loop round the site", () => {
    const cast = buildDiveCast(new Scene());
    expect(CUT_SIDES.reduce((t, s) => t + s.length, 0)).toBe(2 * (CUT.width + CUT.depth));
    expect(cast.cutLines.map((bar) => bar.rotation.y)).toEqual([0, Math.PI / 2, 0, Math.PI / 2]);
    for (let i = 0; i < CUT_SIDES.length; i += 1) {
      const side = CUT_SIDES[i];
      const next = CUT_SIDES[(i + 1) % CUT_SIDES.length];
      expect(side.from[0] + side.dir[0] * side.length).toBeCloseTo(next.from[0]);
      expect(side.from[1] + side.dir[1] * side.length).toBeCloseTo(next.from[1]);
    }
  });
});
