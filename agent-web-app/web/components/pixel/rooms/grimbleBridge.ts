import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { disc, lightsOff, moodBubble, skyColors, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { GRIMBLE } from "../sprites/grimble.ts";

/* Grimble's counting house under the old toll bridge: a stone arch overhead, a mossy bank, the river running past, the toll sign, coin piles and an abacus. Working, coins flip from his pouch and the abacus beads slide. */

function arch(p: Painter, hour: number): void {
  const sky = skyColors(hour);
  p.rect(0, 0, ROOM_W, 70, sky.bottom);
  p.rect(0, 0, ROOM_W, 30, sky.top);
  p.rect(0, 0, ROOM_W, 16, "#6a6a60");
  for (let x = 0; x < ROOM_W; x += 10) p.rect(x, 0, 1, 16, "#54544c");
  p.rect(0, 15, ROOM_W, 1, "#54544c");
  for (let x = 0; x < 40; x++) {
    const h = Math.round(16 + Math.pow((40 - x) / 40, 2) * 50);
    p.rect(x, 16, 1, h, "#5c5c54");
    p.rect(ROOM_W - 1 - x, 16, 1, h, "#5c5c54");
  }
  for (let i = 0; i < 8; i++) p.rect(Math.floor(hash(i + 3) * ROOM_W), 15 + Math.floor(hash(i + 9) * 3), 2, 3, "#4e6b34");
}

function river(p: Painter, t: number): void {
  p.rect(0, 96, ROOM_W, ROOM_H - 96, "#2f5a7a");
  for (let i = 0; i < 10; i++) {
    const x = (Math.floor(hash(i) * ROOM_W) + cycle(t, ROOM_W)) % ROOM_W;
    p.rect(x, 99 + (i % 4) * 3, 6, 1, "#6fa0c0");
  }
}

function abacus(p: Painter, scene: Scene): void {
  p.rect(112, 58, 30, 22, "#5a3d2b");
  p.rect(114, 60, 26, 18, "#3a2a1a");
  for (let row = 0; row < 4; row++) {
    p.rect(114, 62 + row * 4, 26, 1, "#b38a3c");
    const slide = scene.state === "WORKING" ? cycle(scene.t + row * 3, 6) : 0;
    for (let b = 0; b < 3; b++) p.rect(116 + b * 3 + slide * 2, 61 + row * 4, 2, 3, row % 2 ? "#c62832" : "#e2b33c");
  }
  p.rect(114, 80, 3, 8, "#5a3d2b");
  p.rect(137, 80, 3, 8, "#5a3d2b");
}

export function drawGrimbleBridge(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  arch(p, scene.hour);
  p.rect(0, 80, ROOM_W, 16, "#4e6b34");
  p.rect(0, 80, ROOM_W, 2, "#6a8a44");
  river(p, t);
  p.rect(14, 44, 4, 36, "#5a3d2b");
  p.rect(6, 34, 24, 12, "#8a5a30");
  p.rect(8, 36, 20, 8, "#c8a070");
  disc(p, 18, 40, 3, "#e2b33c");
  for (let i = 0; i < 9; i++) p.rect(26 + (i % 5) * 3, 86 - Math.floor(i / 5) * 2 - (i % 2), 3, 2, "#e2b33c");
  for (let i = 0; i < 5; i++) p.rect(44 + (i % 3) * 3, 88 - Math.floor(i / 3) * 2, 3, 2, "#c8962a");
  p.rect(98, 84, 3, 4, "#e8e1d3");
  p.rect(97, 82, 5, 2, "#c62832");
  abacus(p, scene);
  drawCharacter(p, GRIMBLE, 68, 62, scene);
  if (state === "WORKING") {
    const arc = cycle(t, 6);
    p.rect(84 + arc * 2, 70 - [0, 4, 6, 6, 4, 0][arc], 2, 2, "#e2b33c");
  }
  statusLamp(p, 140, 22, state, t);
  lightsOff(p, state);
  moodBubble(p, 76, 59, state, t);
}
