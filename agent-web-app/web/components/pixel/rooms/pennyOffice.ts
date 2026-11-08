import { ROOM_H, ROOM_W, cycle, type Painter, type Scene } from "../pixelKit.ts";
import { checker, disc, lightsOff, moodBubble, skyWindow, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { PENNY } from "../sprites/penny.ts";

/* Penny's 1950s office: mint wallpaper, a checkerboard floor, a wall clock on real time, a filing cabinet, and Penny as a hologram over a brass console. Working, she types, the page rolls up and the bell dings. */

function wallClock(p: Painter, hour: number, t: number): void {
  disc(p, 128, 20, 9, "#b38a3c");
  disc(p, 128, 20, 7, "#f7f5ef");
  const a = ((hour % 12) / 12) * Math.PI * 2 - Math.PI / 2;
  for (let i = 1; i <= 4; i++) p.rect(128 + Math.round(Math.cos(a) * i), 20 + Math.round(Math.sin(a) * i), 1, 1, "#1d1f22");
  const m = (cycle(t, 60) / 60) * Math.PI * 2 - Math.PI / 2;
  for (let i = 1; i <= 6; i++) p.rect(128 + Math.round(Math.cos(m) * i), 20 + Math.round(Math.sin(m) * i), 1, 1, "#c62832");
}

export function drawPennyOffice(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  p.rect(0, 0, ROOM_W, 80, "#cfe8e0");
  for (let y = 4; y < 76; y += 8) for (let x = (y / 4) % 4 === 1 ? 4 : 0; x < ROOM_W; x += 8) p.rect(x, y, 2, 2, "#a8d0c4");
  p.rect(0, 72, ROOM_W, 8, "#8a5a30");
  checker(p, 80, ROOM_H - 80, "#1d1f22", "#e8e1d3");
  skyWindow(p, 14, 10, 26, 20, scene.hour, "#f7f5ef");
  wallClock(p, scene.hour, t);
  p.rect(140, 40, 16, 40, "#7c8794");
  for (const y of [44, 56, 68]) p.rect(142, y, 12, 9, "#9aa3ad");
  p.rect(18, 58, 10, 14, "#b4562a");
  p.rect(16, 46, 14, 12, "#3d7a3a");
  p.rect(20, 42, 6, 6, "#4f8a4b");
  p.rect(52, 84, 56, 10, "#b38a3c");
  p.rect(56, 94, 48, 10, "#8a6a2c");
  p.rect(76, 80, 8, 4, "#7fe3e0");
  if (state !== "ASLEEP") p.rect(62, 46, 36, 36, "rgba(127,227,224,0.16)");
  const flicker = state === "ALERT" ? cycle(t, 3) === 0 : cycle(t, 23) === 0;
  if (!flicker) drawCharacter(p, PENNY, 72, 56, scene);
  for (let y = 56; y < 74; y += 2) p.rect(72, y, 16, 1, "rgba(15,40,45,0.18)");
  if (state === "WORKING") {
    const roll = cycle(t, 8);
    p.rect(78, 56 - roll, 4, roll, "#ffffff");
    for (let i = 0; i < roll; i += 2) p.rect(79, 56 - roll + i, 2, 1, "#9aa3ad");
    if (roll === 7) {
      p.rect(92, 54, 4, 4, "#ffe680");
      p.rect(96, 52, 2, 2, "#ffe680");
    }
  }
  p.rect(112, 86, 18, 6, "#f7f5ef");
  p.rect(113, 84, 16, 2, "#e8e1d3");
  statusLamp(p, 108, 10, state, t);
  lightsOff(p, state);
  moodBubble(p, 84, 54, state, t);
}
