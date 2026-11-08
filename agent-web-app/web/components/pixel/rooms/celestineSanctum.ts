import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { disc, lightsOff, moodBubble, skyColors, statusLamp } from "../scenery.ts";
import { CELESTINE } from "../sprites/celestine.ts";
import { drawCharacter } from "../sprites/character.ts";

/* Celestine's sanctum: an indigo room of twinkling stars, a moon window, candles and a draped table with the crystal ball. Working, the ball blazes and sparks orbit it. */

function moonWindow(p: Painter, hour: number): void {
  const sky = skyColors(hour);
  disc(p, 80, 22, 16, "#b38a3c");
  disc(p, 80, 22, 14, sky.top);
  p.rect(66, 22, 29, 14, sky.bottom);
  p.rect(64, 34, 33, 3, "#b38a3c");
  if (sky.night) {
    disc(p, 84, 16, 5, "#f5f0c8");
    disc(p, 86, 14, 5, sky.top);
  } else {
    disc(p, 80, 20, 4, "#ffe680");
  }
}

function candle(p: Painter, x: number, y: number, t: number, lit: boolean): void {
  p.rect(x, y, 3, 7, "#e8e1d3");
  if (!lit) return;
  const flick = cycle(t + x, 3);
  p.rect(x + 1, y - 2 - (flick === 0 ? 1 : 0), 1, 2, "#ffb347");
  p.rect(x + 1, y - 1, 1, 1, "#fff2a8");
}

export function drawCelestineSanctum(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  p.rect(0, 0, ROOM_W, 82, "#1d1640");
  for (let i = 0; i < 24; i++) {
    if (cycle(t + i * 5, 16) === 0) continue;
    p.rect(Math.floor(hash(i) * ROOM_W), Math.floor(hash(i + 50) * 74), 1, 1, i % 3 ? "#8a7ac8" : "#e9d27a");
  }
  p.rect(0, 82, ROOM_W, ROOM_H - 82, "#2a1a40");
  for (let x = 6; x < ROOM_W; x += 16) p.rect(x, 96, 8, 2, "#4a2a6a");
  moonWindow(p, scene.hour);
  p.rect(0, 0, 14, 82, "#4a2a6a");
  p.rect(ROOM_W - 14, 0, 14, 82, "#4a2a6a");
  for (let y = 4; y < 82; y += 6) p.rect(12, y, 1, 3, "#3a1f55");
  p.rect(20, 48, 22, 3, "#5a3d2b");
  p.rect(118, 48, 22, 3, "#5a3d2b");
  const lit = state !== "ASLEEP";
  for (const x of [23, 31, 121, 131]) candle(p, x, 41, t, lit);
  drawCharacter(p, CELESTINE, 72, 33, scene);
  p.rect(46, 56, 68, 6, "#5a2a7a");
  p.rect(48, 62, 64, 22, "#4a2066");
  for (let x = 48; x < 112; x += 4) p.rect(x, 84, 2, 2, "#e2b33c");
  const working = state === "WORKING";
  const glow = working ? cycle(t, 4) : 0;
  if (working) disc(p, 80, 51, 9 + (glow % 2), "rgba(169,216,245,0.25)");
  p.rect(76, 55, 9, 3, "#b38a3c");
  disc(p, 80, 50, 5, state === "ALERT" ? "#f0a0a8" : "#a9d8f5");
  p.rect(78, 47, 2, 2, "#ffffff");
  if (working) {
    for (let i = 0; i < 3; i++) {
      const a = ((cycle(t, 12) + i * 4) / 12) * Math.PI * 2;
      p.rect(80 + Math.round(Math.cos(a) * 9), 50 + Math.round(Math.sin(a) * 5), 1, 1, "#e9d27a");
    }
  }
  p.rect(56, 58, 5, 7, "#e8e1d3");
  p.rect(100, 58, 5, 7, "#c62832");
  statusLamp(p, 146, 8, state, t);
  lightsOff(p, state);
  moodBubble(p, 86, 31, state, t);
}
