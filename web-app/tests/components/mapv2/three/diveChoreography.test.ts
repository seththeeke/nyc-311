import { describe, expect, it } from "vitest";
import { Scene } from "three";
import { buildDiveCast, CUT, SITE, TRUCK_PARK_X, TRUCK_START_X } from "../../../../src/components/mapv2/three/diveCast";
import { choreograph, sawPoint } from "../../../../src/components/mapv2/three/diveChoreography";

/* Phase starts in the street repair loop: ARRIVE 0, SECURE 3.5, CUT 6.5, CLEAR 10.5, FILL 13.5, COMPACT 17.5, DONE 22. */
function cast() {
  return buildDiveCast(new Scene());
}

describe("sawPoint", () => {
  it("walks the outline from the near-left corner, clockwise, with an outward normal", () => {
    expect(sawPoint(0)).toEqual({ x: SITE.x - CUT.width / 2, z: SITE.z + CUT.depth / 2, outX: -0, outZ: 1 });
    const quarter = sawPoint(CUT.width / (2 * (CUT.width + CUT.depth)));
    expect(quarter.x).toBeCloseTo(SITE.x + CUT.width / 2);
    const second = sawPoint(0.5);
    expect(second).toMatchObject({ outX: 1, outZ: 0 });
    expect(sawPoint(1).x).toBeCloseTo(SITE.x - CUT.width / 2);
  });
});

describe("choreograph — street repair", () => {
  it("drives the truck in, crew hidden, then parks it working", () => {
    const c = cast();
    expect(choreograph(c, "STREET_REPAIR", 0).phase).toBe("ARRIVE");
    expect(c.truck.root.position.x).toBe(TRUCK_START_X);
    expect(c.truck.activity).toBe("TRANSIT");
    expect(c.crew.cutter.root.visible).toBe(false);
    choreograph(c, "STREET_REPAIR", 3.6);
    expect(c.truck.root.position.x).toBeCloseTo(TRUCK_PARK_X);
    expect(c.truck.activity).toBe("WORKING");
  });

  it("walks the crew out and pops the cones in while securing", () => {
    const c = cast();
    choreograph(c, "STREET_REPAIR", 3.6);
    expect(c.crew.raker.root.visible).toBe(true);
    expect(c.cones[c.cones.length - 1].visible).toBe(false);
    choreograph(c, "STREET_REPAIR", 6.4);
    expect(c.cones.every((cone) => cone.visible)).toBe(true);
  });

  it("draws the cut and throws sparks at the blade mid-cut", () => {
    const c = cast();
    choreograph(c, "STREET_REPAIR", 8.5);
    expect(c.cutLines[0].visible).toBe(true);
    expect(c.cutLines[3].visible).toBe(false);
    expect(c.sparks.group.visible).toBe(true);
    expect(c.crew.cutter.tools.SAW.visible).toBe(true);
  });

  it("clears debris to the truck, then pours a hot patch with steam", () => {
    const c = cast();
    choreograph(c, "STREET_REPAIR", 11);
    expect(c.debris.some((d) => d.visible)).toBe(true);
    expect(c.sparks.group.visible).toBe(false);
    choreograph(c, "STREET_REPAIR", 15.5);
    expect(c.debris.every((d) => !d.visible)).toBe(true);
    expect(c.patch.visible).toBe(true);
    expect(c.patchMaterial.emissiveIntensity).toBeGreaterThan(0.5);
    expect(c.steam.group.visible).toBe(true);
  });

  it("rolls the patch cool while compacting, then drives the roller off and reopens", () => {
    const c = cast();
    choreograph(c, "STREET_REPAIR", 17.6);
    expect(c.roller.root.visible).toBe(true);
    expect(c.roller.root.position.x).toBeGreaterThan(1.6);
    choreograph(c, "STREET_REPAIR", 20);
    expect(Math.abs(c.roller.root.position.x)).toBeLessThanOrEqual(1.6);
    choreograph(c, "STREET_REPAIR", 22.5);
    expect(c.patchMaterial.emissiveIntensity).toBe(0);
    expect(c.doneRing.visible).toBe(true);
    expect(c.crew.raker.tools.SHOVEL.visible).toBe(false);
    choreograph(c, "STREET_REPAIR", 24.9);
    expect(c.roller.root.visible).toBe(false);
    expect(c.cones.every((cone) => !cone.visible)).toBe(true);
  });
});

describe("choreograph — generic job", () => {
  it("keeps the repair props hidden and hammers away at the site", () => {
    const c = cast();
    const state = choreograph(c, "GENERIC", 6.5 + 0.2);
    expect(state.phase).toBe("WORK");
    expect(c.pothole.visible).toBe(false);
    expect(c.patch.visible).toBe(false);
    expect(c.crew.cutter.tools.HAMMER.visible).toBe(true);
    expect(c.cutLines.every((bar) => !bar.visible)).toBe(true);
  });

  it("flickers sparks only while working", () => {
    const c = cast();
    const visibleAt = (s: number) => {
      choreograph(c, "GENERIC", s);
      return c.sparks.group.visible;
    };
    const during = [7, 8, 9, 10, 11, 12].map(visibleAt);
    expect(during).toContain(true);
    expect(during).toContain(false);
    expect(visibleAt(1)).toBe(false);
  });
});
