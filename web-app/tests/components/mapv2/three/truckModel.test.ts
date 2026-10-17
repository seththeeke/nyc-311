import { describe, expect, it } from "vitest";
import { Mesh, type MeshBasicMaterial, type Object3D } from "three";
import { buildTruck } from "../../../../src/components/mapv2/three/truckModel";

function findAll(root: Object3D, test: (o: Object3D) => boolean): Object3D[] {
  const found: Object3D[] = [];
  root.traverse((o) => {
    if (test(o)) found.push(o);
  });
  return found;
}

describe("buildTruck", () => {
  it("builds a body, ground effects and six wheels", () => {
    const truck = buildTruck("IDLE");
    expect(truck.root.children).toEqual([truck.ground, truck.body]);
    expect(truck.activity).toBe("IDLE");
    expect(findAll(truck.body, (o) => o instanceof Mesh && o.children.length === 1)).toHaveLength(6);
  });

  it("recolours its accents and glows when the activity changes", () => {
    const truck = buildTruck("IDLE");
    truck.setActivity("WORKING");
    expect(truck.activity).toBe("WORKING");
    const glows = findAll(truck.ground, (o) => o instanceof Mesh && (o.material as MeshBasicMaterial).color.getHexString() === "3b82f6");
    expect(glows.length).toBeGreaterThanOrEqual(2);
  });

  it("shows a selection ring only while selected", () => {
    const truck = buildTruck("TRANSIT");
    const ring = truck.ground.children[truck.ground.children.length - 1];
    expect(ring.visible).toBe(false);
    truck.setSelected(true);
    expect(ring.visible).toBe(true);
  });

  it("drives in TRANSIT: beams on, beacon off, wheels spin faster mid-glide", () => {
    const truck = buildTruck("TRANSIT");
    const wheel = findAll(truck.body, (o) => o instanceof Mesh && o.children.length === 1)[0];
    truck.update(1, false);
    const idleSpin = wheel.rotation.z;
    truck.update(1, true);
    expect(Math.abs(wheel.rotation.z)).toBeGreaterThan(Math.abs(idleSpin));
    const beams = truck.body.children.find((c) => c.children.length === 2 && c.position.x === 0 && !(c instanceof Mesh));
    expect(beams?.visible).toBe(true);
  });

  it("parks with a spinning beacon and a pulse in WORKING, and breathes in IDLE", () => {
    const working = buildTruck("WORKING");
    working.update(0.4, false);
    const pulse = working.ground.children[2];
    expect(pulse.visible).toBe(true);
    expect(pulse.scale.x).toBeGreaterThan(1);
    const idle = buildTruck("IDLE");
    idle.update(0.4, false);
    expect(idle.ground.children[2].visible).toBe(false);
    expect(idle.body.position.y).toBe(0);
  });
});
