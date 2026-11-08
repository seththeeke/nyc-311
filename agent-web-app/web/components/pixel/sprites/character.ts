import { cycle, sprite, type Painter, type Scene, type SpritePalette } from "../pixelKit.ts";

/** One agent's pixel figure: an idle pose, a loop of work frames, and where its eyes are so they can blink and close. */
export interface CharacterSprite {
  palette: SpritePalette;
  idle: readonly string[];
  work: readonly (readonly string[])[];
  /** Eye pixels, relative to the sprite's top-left; null when the eyes are hidden (a helmet). */
  eyes: readonly (readonly [number, number])[];
  /** The colour a closed eye becomes. */
  lid: string;
}

/**
 * Draws the figure for the scene: working loops the work frames, idle
 * breathes and blinks, asleep closes the eyes and slumps a pixel, and an
 * alert stands still, eyes wide.
 */
export function drawCharacter(p: Painter, c: CharacterSprite, x: number, y: number, scene: Scene, flip = false): void {
  const { state, t } = scene;
  const working = state === "WORKING";
  const rows = working ? c.work[cycle(t, c.work.length, 2)] : c.idle;
  const dy = state === "ASLEEP" ? 1 : state === "IDLE" ? cycle(t, 2, 8) : 0;
  sprite(p, rows, c.palette, x, y + dy, flip);
  const blink = state === "IDLE" && cycle(t, 40) === 0;
  if (working || !(state === "ASLEEP" || blink)) return;
  const width = c.idle[0].length;
  for (const [ex, ey] of c.eyes) p.rect(x + (flip ? width - 1 - ex : ex), y + dy + ey, 1, 1, c.lid);
}
