/**
 * The Pixel Office's drawing kit: every room paints into a small buffer
 * (ROOM_W × ROOM_H "pixels") through a Painter, which the canvas scales up
 * with crisp edges. Drawing goes through this interface, never the canvas
 * directly, so rooms are plain functions tests can run without a canvas.
 */
export const ROOM_W = 160;
export const ROOM_H = 112;

/** Frames per second of the room animations; `Scene.t` counts frames. */
export const FPS = 8;

export interface Painter {
  rect(x: number, y: number, w: number, h: number, color: string): void;
}

/** What an agent is doing, as a room shows it. */
export type RoomState = "WORKING" | "IDLE" | "ASLEEP" | "ALERT";

export interface Scene {
  /** Frame counter, FPS per second. */
  t: number;
  state: RoomState;
  /** Local hour 0–23, for windows and lamps. */
  hour: number;
}

export type RoomDraw = (p: Painter, scene: Scene) => void;

/** Palette for an ASCII sprite: one character per colour; '.' is transparent. */
export type SpritePalette = Record<string, string>;

/** Paints an ASCII sprite with its top-left at (x, y), mirrored when `flip`. Runs of one colour become one rect. */
export function sprite(p: Painter, rows: readonly string[], palette: SpritePalette, x: number, y: number, flip = false): void {
  rows.forEach((row, dy) => {
    const line = flip ? [...row].reverse().join("") : row;
    let start = 0;
    for (let dx = 1; dx <= line.length; dx++) {
      if (dx < line.length && line[dx] === line[start]) continue;
      const color = palette[line[start]];
      if (color) p.rect(x + start, y + dy, dx - start, 1, color);
      start = dx;
    }
  });
}

/** A Painter over a 2D canvas context. */
export function canvasPainter(ctx: CanvasRenderingContext2D): Painter {
  return {
    rect(x, y, w, h, color) {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    },
  };
}

/** A cheap deterministic hash for scattering stars, coins and dust the same way every frame. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/** 0..period-1, stepping once every `every` frames. */
export function cycle(t: number, period: number, every = 1): number {
  return Math.floor(t / every) % period;
}
