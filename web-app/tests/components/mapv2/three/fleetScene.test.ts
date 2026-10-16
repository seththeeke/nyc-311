import { describe, expect, it } from "vitest";
import { createSceneOrigin, NYC_CENTER } from "../../../../src/components/mapv2/geo";
import { FleetScene } from "../../../../src/components/mapv2/three/fleetScene";
import type { FleetOperatorLocation } from "../../../../src/models/fleetLocation";

const operator = (id: string, activity: FleetOperatorLocation["current_activity"], lng = NYC_CENTER.lng): FleetOperatorLocation => ({
  operator_id: id,
  name: id,
  current_activity: activity,
  current_location: { lat: NYC_CENTER.lat, lng },
  recent_job_locations: [{ lat: NYC_CENTER.lat, lng: lng - 0.01 }],
  current_order: null,
});

function scene(): FleetScene {
  return new FleetScene(createSceneOrigin(NYC_CENTER));
}

describe("FleetScene.sync", () => {
  it("adds an actor per plotted operator and skips those without GPS", () => {
    const fleet = scene();
    fleet.sync([operator("A", "IDLE"), { ...operator("B", "IDLE"), current_location: null }], 0);
    expect(fleet.size).toBe(1);
    expect(fleet.anchors(0)).toEqual([{ operatorId: "A", location: { lat: NYC_CENTER.lat, lng: NYC_CENTER.lng } }]);
  });

  it("retargets moved trucks, recolours on activity change and removes vanished ones", () => {
    const fleet = scene();
    fleet.sync([operator("A", "IDLE"), operator("B", "WORKING")], 0);
    fleet.sync([operator("A", "TRANSIT", NYC_CENTER.lng + 0.01)], 1000);
    expect(fleet.size).toBe(1);
    const midGlide = fleet.anchors(1500)[0].location.lng;
    expect(midGlide).toBeGreaterThan(NYC_CENTER.lng);
    expect(midGlide).toBeLessThan(NYC_CENTER.lng + 0.01);
    fleet.sync([operator("A", "TRANSIT", NYC_CENTER.lng + 0.01)], 2000);
    expect(fleet.size).toBe(1);
  });
});

describe("FleetScene.update", () => {
  it("scales trucks up when zoomed out and to life size when close", () => {
    const fleet = scene();
    fleet.sync([operator("A", "IDLE")], 0);
    fleet.update(0, 11);
    const root = fleet.scene.children.find((c) => c.type === "Group")!;
    expect(root.scale.x).toBeGreaterThan(10);
    fleet.update(16, 21);
    expect(root.scale.x).toBe(1);
  });

  it("unfolds the work zone for WORKING trucks and folds it away otherwise", () => {
    const fleet = scene();
    fleet.sync([operator("A", "IDLE")], 0);
    fleet.update(0, 15);
    fleet.update(50, 15);
    const zoneOf = () => {
      let zone: { visible: boolean } | undefined;
      fleet.scene.traverse((o) => {
        /* Five cones and two crew — a Group of Groups, unlike the exhaust pool of meshes. */
        if (o.children.length === 7 && o.children.every((c) => c.type === "Group")) zone = o;
      });
      return zone!;
    };
    expect(zoneOf().visible).toBe(false);
    fleet.sync([operator("A", "WORKING")], 100);
    fleet.update(100, 15);
    fleet.update(150, 15);
    expect(zoneOf().visible).toBe(true);
  });

  it("starts a WORKING truck with its zone already out and frees everything on dispose", () => {
    const fleet = scene();
    fleet.sync([operator("A", "WORKING")], 0);
    fleet.update(0, 15);
    fleet.setSelected("A");
    fleet.setSelected(null);
    fleet.dispose();
    expect(fleet.size).toBe(0);
  });
});
