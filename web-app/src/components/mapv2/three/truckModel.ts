import { Color, ConeGeometry, CylinderGeometry, Group, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, RingGeometry, CircleGeometry } from "three";
import type { OperatorActivity } from "../../../models/fleetLocation";
import { ACTIVITY_COLOR } from "../../fleetActivityStyle";
import { box, createPuffPool, glow, mesh, type PuffPool, solid } from "../../three/threeKit";

/*
 * A city utility truck (~8.5 m, faces +x) whose look follows its
 * activity: TRANSIT drives (wheels, headlights, exhaust), WORKING parks
 * with a spinning beacon and a pulse on the ground, IDLE breathes a dim
 * glow. Activity colour comes from the classic map's palette.
 */

export const TRUCK_LENGTH_M = 8.5;
const WHEEL_RADIUS = 0.55;

export interface TruckRig {
  root: Group;
  /** Turned toward the travel heading; everything that rotates with the truck hangs off it. */
  body: Group;
  /** The shadow, halo, pulse and selection ring — map-scale effects a close-up hides. */
  ground: Group;
  activity: OperatorActivity;
  setActivity(activity: OperatorActivity): void;
  setSelected(selected: boolean): void;
  /** `moving` is true mid-glide, when the wheels spin at full speed. */
  update(timeSeconds: number, moving: boolean): void;
}

interface Parts {
  wheels: Mesh[];
  beacon: Group;
  beaconLens: MeshStandardMaterial;
  beams: Group;
  accent: MeshStandardMaterial[];
  halo: MeshBasicMaterial;
  pulse: Mesh;
  pulseMaterial: MeshBasicMaterial;
  selectRing: Mesh;
  exhaust: PuffPool;
}

function buildWheels(body: Group): Mesh[] {
  const tire = new CylinderGeometry(WHEEL_RADIUS, WHEEL_RADIUS, 0.42, 9).rotateX(Math.PI / 2);
  const wheels: Mesh[] = [];
  for (const x of [2.75, -1.05, -2.45]) {
    for (const z of [-1.12, 1.12]) {
      const wheel = mesh(tire, solid("#16181c", { roughness: 0.9 }), [x, WHEEL_RADIUS, z]);
      /* A hub bar makes the spin visible on an otherwise symmetric tyre. */
      wheel.add(box(0.75, 0.12, 0.44, solid("#aab2bd", { metalness: 0.6 })));
      body.add(wheel);
      wheels.push(wheel);
    }
  }
  return wheels;
}

function buildBody(body: Group, accent: MeshStandardMaterial): void {
  const paint = solid("#eef1f5", { roughness: 0.45, metalness: 0.15 });
  body.add(box(8, 0.45, 2.1, solid("#2b2f37"), [0, 0.95, 0]));
  body.add(box(2.3, 2.1, 2.4, paint, [2.85, 2.15, 0]));
  body.add(box(0.08, 1.0, 2.1, solid("#0f1a2b", { emissive: "#5aa9ff", emissiveIntensity: 0.25, metalness: 0.6 }), [4.02, 2.55, 0]));
  body.add(box(5.2, 1.9, 2.5, paint, [-1.1, 2.1, 0]));
  body.add(box(5.22, 0.28, 2.52, accent, [-1.1, 1.55, 0]));
  body.add(box(2.32, 0.2, 2.42, accent, [2.85, 1.4, 0]));
  body.add(box(0.35, 0.22, 2.0, accent, [2.6, 3.32, 0]));
  for (const z of [-0.8, 0.8]) {
    body.add(box(0.06, 0.25, 0.4, solid("#fffbe8", { emissive: "#fff3c4", emissiveIntensity: 1.5 }), [4.03, 1.45, z]));
    body.add(box(0.06, 0.2, 0.3, solid("#ff3344", { emissive: "#ff2233", emissiveIntensity: 1.2 }), [-3.72, 1.5, z]));
  }
}

function buildBeams(): Group {
  const beams = new Group();
  const geometry = new ConeGeometry(1.6, 9, 14, 1, true).rotateZ(Math.PI / 2);
  for (const z of [-0.8, 0.8]) beams.add(mesh(geometry, glow("#fff1c2", 0.09), [8.6, 1.45, z]));
  return beams;
}

function buildBeacon(body: Group): { beacon: Group; lens: MeshStandardMaterial } {
  const beacon = new Group();
  beacon.position.set(-3.1, 3.1, 0);
  const lens = solid("#ffb020", { emissive: "#ffb020", emissiveIntensity: 2 });
  beacon.add(mesh(new CylinderGeometry(0.2, 0.24, 0.3, 10), lens));
  beacon.add(mesh(new ConeGeometry(2.2, 7, 12, 1, true).rotateZ(Math.PI / 2), glow("#ffb020", 0.12), [3.6, 0, 0]));
  body.add(beacon);
  return { beacon, lens };
}

function buildGround(root: Group, color: string): Pick<Parts, "halo" | "pulse" | "pulseMaterial" | "selectRing"> {
  root.add(mesh(new CircleGeometry(4.6, 24).rotateX(-Math.PI / 2), solid("#000000", { transparent: true, opacity: 0.35 }), [0, 0.03, 0]));
  const halo = glow(color, 0.28);
  root.add(mesh(new CircleGeometry(7, 32).rotateX(-Math.PI / 2), halo, [0, 0.05, 0]));
  const pulseMaterial = glow(color, 0.5);
  const pulse = mesh(new RingGeometry(0.85, 1, 48).rotateX(-Math.PI / 2), pulseMaterial, [0, 0.07, 0]);
  root.add(pulse);
  const selectRing = mesh(new RingGeometry(8, 8.8, 48).rotateX(-Math.PI / 2), glow("#ffffff", 0.75), [0, 0.08, 0]);
  selectRing.visible = false;
  root.add(selectRing);
  return { halo, pulse, pulseMaterial, selectRing };
}

export function buildTruck(activity: OperatorActivity): TruckRig {
  const root = new Group();
  const body = new Group();
  const ground = new Group();
  root.add(ground, body);
  const color = ACTIVITY_COLOR[activity];
  const accentMaterial = solid(color, { emissive: color, emissiveIntensity: 0.55 });
  buildBody(body, accentMaterial);
  const { beacon, lens } = buildBeacon(body);
  const beams = buildBeams();
  body.add(beams);
  const exhaust = createPuffPool({ count: 7, color: "#9aa3b2", size: 0.22, growTo: 4, rise: [-2.4, 3.2, 0], lifetimeSeconds: 1.8, maxOpacity: 0.45 });
  exhaust.group.position.set(-3.9, 1.0, 0.9);
  body.add(exhaust.group);
  const parts: Parts = { wheels: buildWheels(body), beacon, beaconLens: lens, beams, accent: [accentMaterial], exhaust, ...buildGround(ground, color) };

  const rig: TruckRig = {
    root,
    body,
    ground,
    activity,
    setActivity(next) {
      rig.activity = next;
      const nextColor = new Color(ACTIVITY_COLOR[next]);
      for (const material of parts.accent) {
        material.color.copy(nextColor);
        material.emissive.copy(nextColor);
      }
      parts.halo.color.copy(nextColor);
      parts.pulseMaterial.color.copy(nextColor);
    },
    setSelected(selected) {
      parts.selectRing.visible = selected;
    },
    update(t, moving) {
      animateTruck(rig, parts, t, moving);
    },
  };
  return rig;
}

function animateTruck(rig: TruckRig, parts: Parts, t: number, moving: boolean): void {
  const isTransit = rig.activity === "TRANSIT";
  const isWorking = rig.activity === "WORKING";
  const wheelSpeed = moving ? 9 : isTransit ? 1.2 : 0;
  for (const wheel of parts.wheels) wheel.rotation.z = -t * wheelSpeed;
  rig.body.position.y = isTransit ? Math.sin(t * (moving ? 14 : 5)) * 0.04 : 0;
  parts.beams.visible = isTransit;
  parts.beams.rotation.y = Math.sin(t * 0.8) * 0.08;
  parts.exhaust.update(t, isTransit ? (moving ? 1 : 0.5) : 0);
  parts.beacon.visible = isWorking;
  parts.beacon.rotation.y = t * 5;
  parts.beaconLens.emissiveIntensity = 1.4 + Math.sin(t * 10) * 0.6;
  /* WORKING sends a slow ring outward; IDLE just breathes. */
  const cycle = (t / 2.2) % 1;
  parts.pulse.visible = isWorking;
  parts.pulse.scale.setScalar(1 + cycle * 13);
  parts.pulseMaterial.opacity = 0.55 * (1 - cycle);
  parts.halo.opacity = rig.activity === "IDLE" ? 0.14 + (Math.sin(t * 1.4) + 1) * 0.07 : 0.28;
  parts.selectRing.rotation.y = t * 0.6;
}
