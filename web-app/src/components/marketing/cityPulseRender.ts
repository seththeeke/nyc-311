import { BURST_SECONDS, MANHATTAN_TILT_RAD, type CityState } from "./cityPulse";

/* The theme's colours, read from CSS variables so the canvas follows DARK/LIGHT like the rest of the app. */
export interface CityPalette {
  grid: string;
  avenue: string;
  truck: string;
  trail: string;
  ping: string;
  resolved: string;
  glow: string;
}

const FALLBACK: CityPalette = {
  grid: "rgb(148 163 184 / 0.11)",
  avenue: "rgb(148 163 184 / 0.24)",
  truck: "#67e8f9",
  trail: "#c4b5fd",
  ping: "#fcd34d",
  resolved: "#6ee7b7",
  glow: "rgb(103 232 249 / 0.10)",
};

/** Reads the live theme tokens off `<html>`, falling back to the dark palette for any that are unset. */
export function readPalette(root: Element): CityPalette {
  const style = getComputedStyle(root);
  const token = (name: string, fallback: string): string => style.getPropertyValue(name).trim() || fallback;
  return {
    grid: FALLBACK.grid,
    avenue: FALLBACK.avenue,
    truck: token("--t-hue-cyan", FALLBACK.truck),
    trail: token("--t-hue-violet", FALLBACK.trail),
    ping: token("--t-hue-amber", FALLBACK.ping),
    resolved: token("--t-hue-emerald", FALLBACK.resolved),
    glow: FALLBACK.glow,
  };
}

/* Every fourth line is an avenue, drawn brighter, like Manhattan's wide north-south streets. */
const AVENUE_EVERY = 4;

function drawGrid(ctx: CanvasRenderingContext2D, state: CityState, palette: CityPalette): void {
  const { half, spacing } = state;
  ctx.lineWidth = 1;
  for (let v = -half, i = 0; v <= half; v += spacing, i += 1) {
    const avenue = i % AVENUE_EVERY === 0;
    ctx.strokeStyle = avenue ? palette.avenue : palette.grid;
    ctx.beginPath();
    ctx.moveTo(v, -half);
    ctx.lineTo(v, half);
    ctx.stroke();
    ctx.strokeStyle = palette.grid;
    ctx.beginPath();
    ctx.moveTo(-half, v);
    ctx.lineTo(half, v);
    ctx.stroke();
  }
}

function drawPings(ctx: CanvasRenderingContext2D, state: CityState, palette: CityPalette): void {
  for (const ping of state.pings) {
    if (ping.resolvedAt === null) {
      const phase = ((state.time - ping.bornAt) % 1.6) / 1.6;
      ctx.globalAlpha = 1 - phase;
      ctx.strokeStyle = palette.ping;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, 4 + phase * state.spacing * 0.45, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = palette.ping;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, 3, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const t = (state.time - ping.resolvedAt) / BURST_SECONDS;
      ctx.globalAlpha = Math.max(0, 1 - t);
      ctx.strokeStyle = palette.resolved;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(ping.pos.x, ping.pos.y, 6 + t * state.spacing * 1.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
}

function drawTrucks(ctx: CanvasRenderingContext2D, state: CityState, palette: CityPalette): void {
  for (const truck of state.trucks) {
    const { trail } = truck;
    ctx.strokeStyle = palette.trail;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    for (let i = 1; i < trail.length; i += 1) {
      ctx.globalAlpha = (i / trail.length) * 0.7;
      ctx.beginPath();
      ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
      ctx.lineTo(trail[i].x, trail[i].y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.shadowColor = palette.truck;
    ctx.shadowBlur = 14;
    ctx.fillStyle = palette.truck;
    ctx.beginPath();
    ctx.arc(truck.pos.x, truck.pos.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/** Draws one frame: the tilted grid, the calls, the trucks, then a soft light under the pointer. */
export function renderCity(
  ctx: CanvasRenderingContext2D,
  state: CityState,
  palette: CityPalette,
  size: { width: number; height: number },
  pointer: { x: number; y: number } | null,
): void {
  ctx.clearRect(0, 0, size.width, size.height);
  ctx.save();
  ctx.translate(size.width / 2, size.height / 2);
  ctx.rotate(-MANHATTAN_TILT_RAD);
  drawGrid(ctx, state, palette);
  drawPings(ctx, state, palette);
  drawTrucks(ctx, state, palette);
  ctx.restore();
  if (pointer) {
    const radius = Math.min(size.width, size.height) * 0.35;
    const light = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, radius);
    light.addColorStop(0, palette.glow);
    light.addColorStop(1, "rgb(0 0 0 / 0)");
    ctx.fillStyle = light;
    ctx.fillRect(0, 0, size.width, size.height);
  }
}
