/*
 * The marketing hero's living city: a Manhattan-style street grid where 311
 * calls ping in and glowing trucks drive the streets to resolve them. Pure
 * state + step logic so it tests without a canvas; cityPulseRender.ts draws it.
 * Coordinates are grid-local (unrotated, centred on 0,0); the renderer applies
 * Manhattan's 29° tilt.
 */

export interface Vec {
  x: number;
  y: number;
}

export interface Truck {
  pos: Vec;
  heading: Vec;
  speed: number;
  /* Recent positions, newest last, for the light trail. */
  trail: Vec[];
  targetId: number | null;
}

export interface Ping {
  id: number;
  pos: Vec;
  bornAt: number;
  resolvedAt: number | null;
}

export interface CityState {
  /* Half the grid's side length: the grid covers the screen's diagonal so the tilt never shows an edge. */
  half: number;
  spacing: number;
  time: number;
  trucks: Truck[];
  pings: Ping[];
  nextPingId: number;
  spawnTimer: number;
  resolvedCount: number;
}

export type Rng = () => number;

export const MANHATTAN_TILT_RAD = (29 * Math.PI) / 180;
export const TRAIL_LENGTH = 26;
export const MAX_PINGS = 14;
export const PING_SPAWN_SECONDS = 0.55;
/* How long a resolved ping's burst plays before it is dropped. */
export const BURST_SECONDS = 1.4;

const TURN_CHANCE = 0.35;

function snap(value: number, spacing: number): number {
  return Math.round(value / spacing) * spacing;
}

function randomIntersection(half: number, spacing: number, rng: Rng): Vec {
  const cells = Math.floor(half / spacing);
  const pick = (): number => (Math.floor(rng() * (cells * 2 + 1)) - cells) * spacing;
  return { x: pick(), y: pick() };
}

/** A fresh city sized for a `width` x `height` viewport. */
export function createCity(width: number, height: number, truckCount: number, rng: Rng): CityState {
  const spacing = Math.max(28, Math.round(Math.min(width, height) / 14));
  const half = Math.ceil(Math.hypot(width, height) / 2 / spacing) * spacing;
  const trucks: Truck[] = [];
  for (let i = 0; i < truckCount; i += 1) {
    const pos = randomIntersection(half * 0.6, spacing, rng);
    const heading = rng() < 0.5 ? { x: rng() < 0.5 ? -1 : 1, y: 0 } : { x: 0, y: rng() < 0.5 ? -1 : 1 };
    trucks.push({ pos, heading, speed: spacing * (2.2 + rng() * 1.6), trail: [], targetId: null });
  }
  return { half, spacing, time: 0, trucks, pings: [], nextPingId: 1, spawnTimer: 0, resolvedCount: 0 };
}

/** Which way to leave an intersection: toward the target if there is one, else mostly straight with the odd turn. */
export function chooseHeading(pos: Vec, heading: Vec, target: Vec | null, spacing: number, rng: Rng): Vec {
  if (target) {
    const dx = target.x - pos.x;
    const dy = target.y - pos.y;
    const xFar = Math.abs(dx) > spacing / 2;
    const yFar = Math.abs(dy) > spacing / 2;
    if (xFar && (Math.abs(dx) >= Math.abs(dy) || !yFar)) return { x: Math.sign(dx), y: 0 };
    if (yFar) return { x: 0, y: Math.sign(dy) };
    return heading;
  }
  if (rng() >= TURN_CHANCE) return heading;
  const sign = rng() < 0.5 ? -1 : 1;
  return heading.x !== 0 ? { x: 0, y: sign } : { x: sign, y: 0 };
}

function keepInBounds(pos: Vec, heading: Vec, half: number, spacing: number): Vec {
  const next = { x: pos.x + heading.x * spacing, y: pos.y + heading.y * spacing };
  if (Math.abs(next.x) > half || Math.abs(next.y) > half) return { x: 0 - heading.x, y: 0 - heading.y };
  return heading;
}

function assignTargets(state: CityState): void {
  const claimed = new Set(state.trucks.map((t) => t.targetId).filter((id): id is number => id !== null));
  for (const truck of state.trucks) {
    if (truck.targetId !== null) continue;
    let best: Ping | null = null;
    let bestDist = Infinity;
    for (const ping of state.pings) {
      if (ping.resolvedAt !== null || claimed.has(ping.id)) continue;
      const dist = Math.abs(ping.pos.x - truck.pos.x) + Math.abs(ping.pos.y - truck.pos.y);
      if (dist < bestDist) {
        best = ping;
        bestDist = dist;
      }
    }
    if (best) {
      truck.targetId = best.id;
      claimed.add(best.id);
    }
  }
}

function moveTruck(state: CityState, truck: Truck, dt: number, rng: Rng): void {
  const { spacing } = state;
  let remaining = truck.speed * dt;
  while (remaining > 0) {
    const along = truck.heading.x !== 0 ? truck.pos.x : truck.pos.y;
    const dir = truck.heading.x !== 0 ? truck.heading.x : truck.heading.y;
    const nextStop = dir > 0 ? Math.floor(along / spacing + 1e-9) * spacing + spacing : Math.ceil(along / spacing - 1e-9) * spacing - spacing;
    const toStop = Math.abs(nextStop - along);
    if (remaining < toStop) {
      truck.pos = { x: truck.pos.x + truck.heading.x * remaining, y: truck.pos.y + truck.heading.y * remaining };
      return;
    }
    remaining -= toStop;
    truck.pos = { x: snap(truck.pos.x + truck.heading.x * toStop, spacing), y: snap(truck.pos.y + truck.heading.y * toStop, spacing) };
    const target = state.pings.find((p) => p.id === truck.targetId) ?? null;
    truck.heading = keepInBounds(truck.pos, chooseHeading(truck.pos, truck.heading, target?.pos ?? null, spacing, rng), state.half, spacing);
  }
}

function resolveArrivals(state: CityState): void {
  for (const truck of state.trucks) {
    const ping = state.pings.find((p) => p.id === truck.targetId);
    if (!ping) {
      truck.targetId = null;
      continue;
    }
    if (Math.hypot(ping.pos.x - truck.pos.x, ping.pos.y - truck.pos.y) < state.spacing * 0.3) {
      ping.resolvedAt = state.time;
      truck.targetId = null;
      state.resolvedCount += 1;
    }
  }
}

/** Advances the city by `dt` seconds, in place: spawn calls, dispatch trucks, drive, resolve, retire old bursts. */
export function stepCity(state: CityState, dt: number, rng: Rng): void {
  state.time += dt;
  state.spawnTimer += dt;
  const open = state.pings.filter((p) => p.resolvedAt === null).length;
  if (state.spawnTimer >= PING_SPAWN_SECONDS && open < MAX_PINGS) {
    state.spawnTimer = 0;
    state.pings.push({ id: state.nextPingId, pos: randomIntersection(state.half * 0.7, state.spacing, rng), bornAt: state.time, resolvedAt: null });
    state.nextPingId += 1;
  }
  assignTargets(state);
  for (const truck of state.trucks) {
    moveTruck(state, truck, dt, rng);
    truck.trail.push({ ...truck.pos });
    if (truck.trail.length > TRAIL_LENGTH) truck.trail.shift();
  }
  resolveArrivals(state);
  state.pings = state.pings.filter((p) => p.resolvedAt === null || state.time - p.resolvedAt < BURST_SECONDS);
}

/** A small seeded generator (mulberry32) so the city is reproducible in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
