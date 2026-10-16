import { DirectionalLight, Group, HemisphereLight, Scene } from "three";
import type { FleetOperatorLocation, GpsLocation } from "../../../models/fleetLocation";
import { metersPerPixel, type SceneOrigin, toScene } from "../geo";
import { createMotion, retargetMotion, sampleMotion, type TruckMotion } from "../truckMotion";
import { buildCrew, type CrewRig, poseCrew } from "./crewModel";
import { buildCone } from "./props";
import { approachAngle, disposeObject } from "./threeKit";
import { buildTruck, TRUCK_LENGTH_M, type TruckRig } from "./truckModel";

/*
 * The Three.js side of the city view: one actor per plotted Operator,
 * reconciled on every poll and animated every frame. Trucks render far
 * larger than life when zoomed out, so they stay legible at city scale.
 */

/** On-screen truck length below which the model is scaled up. */
const TARGET_TRUCK_PX = 44;
const TURN_RATE_PER_S = 3;
const ZONE_RATE_PER_S = 2.5;

interface Actor {
  operator: FleetOperatorLocation;
  root: Group;
  rig: TruckRig;
  motion: TruckMotion;
  zone: Group;
  crew: CrewRig[];
  heading: number;
  /** 0..1, eased toward 1 while WORKING so the cones and crew unfold rather than pop in. */
  zoneAmount: number;
}

export interface ActorAnchor {
  operatorId: string;
  location: GpsLocation;
}

type Plotted = FleetOperatorLocation & { current_location: GpsLocation };

function isPlotted(operator: FleetOperatorLocation): operator is Plotted {
  return operator.current_location !== null;
}

function buildWorkZone(): { zone: Group; crew: CrewRig[] } {
  const zone = new Group();
  for (const [x, z] of [[-6, -2.4], [-6, 2.4], [-11, -2.4], [-11, 2.4], [-8.5, 2.9]]) {
    const cone = buildCone();
    cone.position.set(x, 0, z);
    zone.add(cone);
  }
  const crew = [buildCrew(0), buildCrew(1)];
  crew[0].root.position.set(-8, 0, -0.9);
  crew[1].root.position.set(-9.2, 0, 1);
  crew[1].root.rotation.y = Math.PI;
  for (const member of crew) zone.add(member.root);
  return { zone, crew };
}

export class FleetScene {
  readonly scene = new Scene();
  private readonly actors = new Map<string, Actor>();
  private selectedId: string | null = null;
  private lastFrameMs: number | null = null;
  private readonly origin: SceneOrigin;

  constructor(origin: SceneOrigin) {
    this.origin = origin;
    this.scene.add(new HemisphereLight("#dfe9ff", "#2a2f3a", 1.3));
    const sun = new DirectionalLight("#ffffff", 1.8);
    sun.position.set(-60, 120, 80);
    this.scene.add(sun);
  }

  /** Adds, updates and removes actors to match the latest poll. */
  sync(operators: FleetOperatorLocation[], nowMs: number): void {
    const plotted = operators.filter(isPlotted);
    const seen = new Set<string>();
    for (const operator of plotted) {
      seen.add(operator.operator_id);
      const existing = this.actors.get(operator.operator_id);
      if (existing) {
        existing.operator = operator;
        existing.motion = retargetMotion(existing.motion, operator.current_location, nowMs);
        if (existing.rig.activity !== operator.current_activity) existing.rig.setActivity(operator.current_activity);
      } else {
        this.actors.set(operator.operator_id, this.createActor(operator, nowMs));
      }
    }
    for (const [id, actor] of this.actors) {
      if (seen.has(id)) continue;
      this.scene.remove(actor.root);
      disposeObject(actor.root);
      this.actors.delete(id);
    }
    this.applySelection();
  }

  private createActor(operator: Plotted, nowMs: number): Actor {
    const rig = buildTruck(operator.current_activity);
    const { zone, crew } = buildWorkZone();
    rig.body.add(zone);
    const root = new Group();
    root.add(rig.root);
    this.scene.add(root);
    const motion = createMotion(operator.current_location, operator.recent_job_locations[0] ?? null, nowMs);
    const isWorking = operator.current_activity === "WORKING";
    return { operator, root, rig, motion, zone, crew, heading: motion.heading, zoneAmount: isWorking ? 1 : 0 };
  }

  setSelected(operatorId: string | null): void {
    this.selectedId = operatorId;
    this.applySelection();
  }

  private applySelection(): void {
    for (const [id, actor] of this.actors) actor.rig.setSelected(id === this.selectedId);
  }

  /** Advances every actor to `nowMs`, sized for `zoom`. */
  update(nowMs: number, zoom: number): void {
    const dt = this.lastFrameMs === null ? 0 : Math.min(0.1, (nowMs - this.lastFrameMs) / 1000);
    this.lastFrameMs = nowMs;
    const t = nowMs / 1000;
    const scale = Math.max(1, (TARGET_TRUCK_PX * metersPerPixel(zoom, this.origin.lat)) / TRUCK_LENGTH_M);
    for (const actor of this.actors.values()) {
      const sample = sampleMotion(actor.motion, nowMs);
      const at = toScene(sample.location, this.origin);
      actor.root.position.set(at.x, 0, at.z);
      actor.root.scale.setScalar(scale);
      actor.heading = approachAngle(actor.heading, sample.heading, dt * TURN_RATE_PER_S);
      actor.rig.body.rotation.y = actor.heading;
      actor.rig.update(t, sample.isMoving);
      this.animateZone(actor, t, dt);
    }
  }

  private animateZone(actor: Actor, t: number, dt: number): void {
    const target = actor.rig.activity === "WORKING" ? 1 : 0;
    actor.zoneAmount += Math.sign(target - actor.zoneAmount) * Math.min(Math.abs(target - actor.zoneAmount), dt * ZONE_RATE_PER_S);
    actor.zone.visible = actor.zoneAmount > 0.01;
    actor.zone.scale.setScalar(Math.max(0.01, actor.zoneAmount));
    poseCrew(actor.crew[0], "SHOVEL", t * 0.7);
    poseCrew(actor.crew[1], "HAMMER", t);
  }

  /** Where each truck is drawn right now — for click picking and camera follow. */
  anchors(nowMs: number): ActorAnchor[] {
    return [...this.actors.entries()].map(([operatorId, actor]) => ({
      operatorId,
      location: sampleMotion(actor.motion, nowMs).location,
    }));
  }

  get size(): number {
    return this.actors.size;
  }

  dispose(): void {
    for (const actor of this.actors.values()) disposeObject(actor.root);
    this.actors.clear();
  }
}
