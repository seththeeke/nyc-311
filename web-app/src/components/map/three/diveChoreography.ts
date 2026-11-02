import { Color } from "three";
import { type JobPhase, type JobScript, phaseProgress, timelineAt, type TimelineState } from "../repairTimeline";
import { type CrewPose, type CrewRig, poseCrew } from "./crewModel";
import { CUT_SIDES, type DiveCast, SITE, TRUCK_PARK_X, TRUCK_START_X } from "./diveCast";

/*
 * Poses the whole dive-in cast for one instant of the loop. Everything is
 * a pure function of loop time — no state carried between frames — so
 * the loop restarts cleanly and a frozen (reduced-motion) frame is just
 * one call.
 */

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const easeOut = (t: number): number => 1 - (1 - t) ** 3;
/** Overshoots then settles — cones pop rather than fade. */
const backOut = (t: number): number => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;

const HOT_ASPHALT = new Color("#141518");
const CURED_ASPHALT = new Color("#3b3e44");
const CUT_PERIMETER = CUT_SIDES.reduce((total, side) => total + side.length, 0);
const TRUCK_BED: [number, number, number] = [TRUCK_PARK_X - 1, 2.6, SITE.z];
const CREW_DOOR: [number, number] = [TRUCK_PARK_X + 2.5, SITE.z + 1.9];

type Progress = (phase: JobPhase) => number;

const CUTTER_POSE: Record<JobPhase, CrewPose> = { ARRIVE: "IDLE", SECURE: "WALK", CUT: "SAW", CLEAR: "SHOVEL", FILL: "IDLE", COMPACT: "IDLE", WORK: "HAMMER", DONE: "WAVE" };
const RAKER_POSE: Record<JobPhase, CrewPose> = { ARRIVE: "IDLE", SECURE: "WALK", CUT: "IDLE", CLEAR: "SHOVEL", FILL: "SHOVEL", COMPACT: "IDLE", WORK: "SHOVEL", DONE: "WAVE" };

/** Three.js Y rotation that faces a +x-built model along (dx, dz). */
function facing(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** Where the saw blade is on the cut outline, `cut` (0..1) of the way round, plus the outward normal there. */
export function sawPoint(cut: number): { x: number; z: number; outX: number; outZ: number } {
  let remaining = clamp01(cut) * CUT_PERIMETER;
  for (const side of CUT_SIDES) {
    const along = Math.min(side.length, remaining);
    if (remaining <= side.length) {
      return { x: SITE.x + side.from[0] + side.dir[0] * along, z: SITE.z + side.from[1] + side.dir[1] * along, outX: -side.dir[1], outZ: side.dir[0] };
    }
    remaining -= side.length;
  }
  /* v8 ignore next */
  return { x: SITE.x, z: SITE.z, outX: 0, outZ: 1 };
}

function driveTruck(cast: DiveCast, arrive: number, s: number): void {
  cast.truck.root.position.x = lerp(TRUCK_START_X, TRUCK_PARK_X, easeOut(arrive));
  const activity = arrive < 1 ? "TRANSIT" : "WORKING";
  if (cast.truck.activity !== activity) cast.truck.setActivity(activity);
  cast.truck.update(s, arrive < 1);
}

function placeCones(cast: DiveCast, secure: number, done: number): void {
  const retract = clamp01((done - 0.45) / 0.4);
  cast.cones.forEach((cone, i) => {
    const start = (i / cast.cones.length) * 0.6;
    const scale = backOut(clamp01((secure - start) / 0.4)) * (1 - retract);
    cone.visible = scale > 0.001;
    cone.scale.setScalar(Math.max(0.001, scale));
  });
}

function walkTo(rig: CrewRig, home: [number, number], secure: number, s: number): void {
  rig.root.position.set(lerp(CREW_DOOR[0], home[0], secure), 0, lerp(CREW_DOOR[1], home[1], secure));
  rig.root.rotation.y = facing(home[0] - CREW_DOOR[0], home[1] - CREW_DOOR[1]);
  poseCrew(rig, "WALK", s * 1.6);
}

function moveCrew(cast: DiveCast, state: TimelineState, p: Progress, s: number): void {
  const { cutter, raker, flagger } = cast.crew;
  const onSite = p("ARRIVE") >= 1;
  for (const rig of [cutter, raker, flagger]) rig.root.visible = onSite;
  const homes: [CrewRig, [number, number]][] = [
    [cutter, [SITE.x - 1.6, SITE.z + 1.6]],
    [raker, [SITE.x + 1.9, SITE.z - 0.3]],
    [flagger, [-17, SITE.z + 2.4]],
  ];
  if (state.phase === "SECURE") {
    for (const [rig, home] of homes) walkTo(rig, home, easeOut(state.progress), s);
    return;
  }
  for (const [rig, home] of homes) rig.root.position.set(home[0], 0, home[1]);
  flagger.root.rotation.y = Math.PI;
  poseCrew(flagger, "WAVE", s * 0.8);
  raker.root.rotation.y = facing(SITE.x - raker.root.position.x, SITE.z - raker.root.position.z);
  poseCrew(raker, RAKER_POSE[state.phase], s);
  if (state.phase === "CUT") {
    const blade = sawPoint(state.progress);
    cutter.root.position.set(blade.x + blade.outX * 0.7, 0, blade.z + blade.outZ * 0.7);
    cutter.root.rotation.y = facing(-blade.outX, -blade.outZ);
  } else {
    cutter.root.rotation.y = facing(SITE.x - cutter.root.position.x, SITE.z - cutter.root.position.z);
  }
  poseCrew(cutter, CUTTER_POSE[state.phase], s);
}

function animateCut(cast: DiveCast, cut: number, fill: number, s: number): void {
  let start = 0;
  CUT_SIDES.forEach((side, i) => {
    const drawn = Math.min(side.length, Math.max(0, cut * CUT_PERIMETER - start));
    const bar = cast.cutLines[i];
    bar.visible = drawn > 0 && fill < 1;
    bar.scale.x = Math.max(0.001, drawn);
    bar.position.set(SITE.x + side.from[0] + (side.dir[0] * drawn) / 2, 0.03, SITE.z + side.from[1] + (side.dir[1] * drawn) / 2);
    start += side.length;
  });
  cast.cutMaterial.opacity = 0.95 * (1 - fill) * (cut < 1 ? 0.8 + Math.sin(s * 30) * 0.2 : 1);
  const blade = sawPoint(cut);
  cast.sparks.group.position.set(blade.x, 0.08, blade.z);
  cast.sparks.update(s, cut > 0 && cut < 1 ? 1 : 0);
}

function animateDebris(cast: DiveCast, cut: number, clear: number): void {
  cast.debris.forEach((chunk, i) => {
    const home: [number, number, number] = [SITE.x + ((i % 4) - 1.5) * 0.55, 0.1, SITE.z + (Math.floor(i / 4) - 0.5) * 0.6];
    const hop = clamp01((clear - (i / cast.debris.length) * 0.75) / 0.25);
    chunk.visible = cut >= 1 && hop < 1;
    chunk.position.set(lerp(home[0], TRUCK_BED[0], hop), lerp(home[1], TRUCK_BED[1], hop) + 4 * hop * (1 - hop) * 2.2, lerp(home[2], TRUCK_BED[2], hop));
    chunk.rotation.x = i + hop * 6;
  });
}

function animatePatch(cast: DiveCast, fill: number, compact: number, s: number): void {
  const spread = easeOut(fill);
  cast.patch.visible = fill > 0;
  cast.patch.scale.set(0.3 + 0.7 * spread, (0.2 + 0.8 * spread) * (1 - 0.45 * compact), 0.3 + 0.7 * spread);
  const heat = fill > 0 ? 1 - compact : 0;
  cast.patchMaterial.emissiveIntensity = 0.85 * heat * (0.85 + 0.15 * Math.sin(s * 6));
  cast.patchMaterial.color.copy(HOT_ASPHALT).lerp(CURED_ASPHALT, compact);
  cast.steam.update(s, heat);
}

function animateRoller(cast: DiveCast, compact: number, done: number): void {
  const exit = clamp01(done / 0.4);
  let x: number;
  if (done > 0) x = lerp(-1.6, 34, easeOut(exit));
  else if (compact < 0.2) x = lerp(9, 1.6, compact / 0.2);
  else x = 1.6 * Math.cos(((compact - 0.2) / 0.8) * 3 * Math.PI);
  cast.roller.root.visible = compact > 0 && exit < 1;
  cast.roller.root.position.set(x, 0, SITE.z);
  for (const drum of cast.roller.drums) drum.rotation.z = -x / 0.45;
}

function hideRepairProps(cast: DiveCast, work: number, s: number): void {
  cast.pothole.visible = false;
  cast.patch.visible = false;
  cast.roller.root.visible = false;
  for (const bar of cast.cutLines) bar.visible = false;
  for (const chunk of cast.debris) chunk.visible = false;
  cast.steam.update(s, 0);
  cast.sparks.group.position.set(SITE.x - 0.6, 0.08, SITE.z + 0.6);
  cast.sparks.update(s, work > 0 && work < 1 && Math.sin(s * 3) > 0.2 ? 0.8 : 0);
}

/** Poses `cast` for `seconds` into the `script` loop and returns where the loop is. */
export function choreograph(cast: DiveCast, script: JobScript, seconds: number): TimelineState {
  const state = timelineAt(script, seconds);
  const p: Progress = (phase) => phaseProgress(script, seconds, phase);
  driveTruck(cast, p("ARRIVE"), seconds);
  placeCones(cast, p("SECURE"), p("DONE"));
  moveCrew(cast, state, p, seconds);
  if (script === "STREET_REPAIR") {
    cast.pothole.visible = p("FILL") < 0.6;
    animateCut(cast, p("CUT"), p("FILL"), seconds);
    animateDebris(cast, p("CUT"), p("CLEAR"));
    animatePatch(cast, p("FILL"), p("COMPACT"), seconds);
    animateRoller(cast, p("COMPACT"), p("DONE"));
  } else {
    hideRepairProps(cast, p("WORK"), seconds);
  }
  const done = p("DONE");
  cast.doneRing.visible = done > 0 && done < 1;
  cast.doneRing.scale.setScalar(1 + done * 3);
  cast.doneMaterial.opacity = 0.8 * (1 - done);
  return state;
}
