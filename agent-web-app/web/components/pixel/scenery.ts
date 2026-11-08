import { ROOM_W, cycle, hash, type Painter, type RoomState } from "./pixelKit.ts";

/** Sky colours by local hour: night, dawn, day, dusk. */
export function skyColors(hour: number): { top: string; bottom: string; night: boolean } {
  if (hour < 5 || hour >= 21) return { top: "#0b1026", bottom: "#1b2450", night: true };
  if (hour < 8) return { top: "#f4a582", bottom: "#fde0b5", night: false };
  if (hour < 18) return { top: "#5fa8e8", bottom: "#a8d8f8", night: false };
  return { top: "#3b2a5c", bottom: "#e07a5f", night: false };
}

/** A framed window showing the sky for `hour`, with stars at night. */
export function skyWindow(p: Painter, x: number, y: number, w: number, h: number, hour: number, frame = "#3a2a1a"): void {
  const sky = skyColors(hour);
  p.rect(x - 2, y - 2, w + 4, h + 4, frame);
  p.rect(x, y, w, Math.ceil(h / 2), sky.top);
  p.rect(x, y + Math.ceil(h / 2), w, Math.floor(h / 2), sky.bottom);
  if (sky.night) {
    for (let i = 0; i < 6; i++) p.rect(x + Math.floor(hash(i + x) * w), y + Math.floor(hash(i + y + 7) * h), 1, 1, "#f5f0c8");
  }
  p.rect(x + Math.floor(w / 2), y, 1, h, frame);
  p.rect(x, y + Math.floor(h / 2), w, 1, frame);
}

/** Horizontal wood planks. */
export function planks(p: Painter, y: number, h: number, base: string, seam: string): void {
  p.rect(0, y, ROOM_W, h, base);
  for (let row = y + 5; row < y + h; row += 6) p.rect(0, row, ROOM_W, 1, seam);
  for (let row = y, i = 0; row < y + h; row += 6, i++) {
    for (let x = (i * 23) % 31; x < ROOM_W; x += 31) p.rect(x, row, 1, 5, seam);
  }
}

/** Offset stone or brick courses. */
export function bricks(p: Painter, y: number, h: number, base: string, mortar: string, bw = 12, bh = 6): void {
  p.rect(0, y, ROOM_W, h, base);
  for (let row = y, i = 0; row < y + h; row += bh, i++) {
    p.rect(0, row, ROOM_W, 1, mortar);
    for (let x = (i % 2) * (bw / 2); x < ROOM_W; x += bw) p.rect(x, row, 1, bh, mortar);
  }
}

/** A two-colour checkerboard floor. */
export function checker(p: Painter, y: number, h: number, a: string, b: string, size = 8): void {
  for (let row = 0; row * size < h; row++) {
    for (let col = 0; col * size < ROOM_W; col++) p.rect(col * size, y + row * size, size, size, (row + col) % 2 ? a : b);
  }
}

/** A speech bubble over a head: "Zzz" asleep, "!" on alert, "…" working. Nothing when idle. */
export function moodBubble(p: Painter, x: number, y: number, state: RoomState, t: number): void {
  if (state === "IDLE") return;
  if (state === "ASLEEP") {
    const rise = cycle(t, 12, 2);
    for (let i = 0; i < 3; i++) {
      const zy = y - i * 4 - Math.floor(rise / 4);
      if (zy < 1) continue;
      p.rect(x + i * 3, zy, 3, 1, "#e8e8f0");
      p.rect(x + i * 3 + 1, zy + 1, 1, 1, "#e8e8f0");
      p.rect(x + i * 3, zy + 2, 3, 1, "#e8e8f0");
    }
    return;
  }
  p.rect(x - 1, y - 9, 9, 8, "#f8f8f8");
  p.rect(x + 1, y - 1, 2, 2, "#f8f8f8");
  if (state === "ALERT") {
    const on = cycle(t, 2, 2) === 0;
    p.rect(x + 3, y - 8, 2, 4, on ? "#e0303a" : "#7a1a20");
    p.rect(x + 3, y - 3, 2, 1, on ? "#e0303a" : "#7a1a20");
    return;
  }
  const dots = cycle(t, 4, 2);
  for (let i = 0; i < 3; i++) p.rect(x + 1 + i * 2, y - 5, 1, 1, i < dots ? "#30303a" : "#c8c8d0");
}

/** A flashing red beacon on alert, a steady green when working, off otherwise. */
export function statusLamp(p: Painter, x: number, y: number, state: RoomState, t: number): void {
  p.rect(x - 1, y - 1, 5, 5, "#1a1a1e");
  const color = state === "ALERT" ? (cycle(t, 2, 2) === 0 ? "#ff3b3b" : "#5a1010") : state === "WORKING" ? "#4be37a" : "#2a3a2e";
  p.rect(x, y, 3, 3, color);
  if (state === "ALERT" && cycle(t, 2, 2) === 0) p.rect(x - 3, y - 3, 9, 9, "rgba(255,59,59,0.18)");
}

/** A dim overlay for a sleeping (paused) room: the lights are off. */
export function lightsOff(p: Painter, state: RoomState): void {
  if (state === "ASLEEP") p.rect(0, 0, ROOM_W, 200, "rgba(8,10,30,0.45)");
}

/** A filled circle, as horizontal spans. */
export function disc(p: Painter, cx: number, cy: number, r: number, color: string): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.floor(Math.sqrt(r * r - dy * dy));
    p.rect(cx - half, cy + dy, half * 2 + 1, 1, color);
  }
}

/** A one-pixel line (Bresenham), drawn up to `fraction` of its length so it can grow over frames. */
export function line(p: Painter, x0: number, y0: number, x1: number, y1: number, color: string, fraction = 1): void {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  const shown = Math.round(steps * fraction);
  for (let i = 0; i <= shown; i++) {
    const f = steps === 0 ? 0 : i / steps;
    p.rect(Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f), 1, 1, color);
  }
}

/** A cog with `teeth` teeth that turns one notch per step while `turning`. */
export function gear(p: Painter, cx: number, cy: number, r: number, color: string, hub: string, t: number, turning: boolean, teeth = 8): void {
  const phase = turning ? cycle(t, teeth * 2) / (teeth * 2) : 0;
  for (let i = 0; i < teeth; i++) {
    const a = ((i + phase) / teeth) * Math.PI * 2;
    p.rect(Math.round(cx + Math.cos(a) * (r + 1)) - 1, Math.round(cy + Math.sin(a) * (r + 1)) - 1, 3, 3, color);
  }
  disc(p, cx, cy, r, color);
  disc(p, cx, cy, Math.max(1, Math.floor(r / 3)), hub);
}
