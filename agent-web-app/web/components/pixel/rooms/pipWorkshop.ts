import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { gear, lightsOff, moodBubble, planks, skyWindow, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { PIP } from "../sprites/pip.ts";

/* Pip's workshop: a pegboard of tools, brass gears on the wall, a workbench with a green-screen terminal. Working, the gears turn, the terminal scrolls and the wrench throws sparks. */

function pegboard(p: Painter): void {
  p.rect(6, 10, 50, 34, "#c49a64");
  for (let y = 13; y < 44; y += 5) for (let x = 9; x < 56; x += 5) p.rect(x, y, 1, 1, "#8a6a40");
  p.rect(10, 14, 2, 14, "#5a3d2b");
  p.rect(8, 14, 6, 4, "#9aa3ad");
  p.rect(18, 14, 12, 3, "#9aa3ad");
  p.rect(28, 17, 2, 10, "#5a3d2b");
  for (let i = 0; i < 6; i++) p.rect(18 + i * 2, 17, 1, 2, "#9aa3ad");
  p.rect(36, 14, 2, 16, "#c4ccd4");
  p.rect(34, 14, 6, 3, "#c4ccd4");
  p.rect(46, 15, 6, 6, "#b4562a");
  p.rect(44, 30, 10, 8, "#3f5675");
}

function bench(p: Painter, scene: Scene): void {
  p.rect(84, 62, 72, 6, "#8a5a30");
  p.rect(84, 68, 72, 2, "#5a3a1e");
  p.rect(88, 70, 4, 18, "#5a3a1e");
  p.rect(148, 70, 4, 18, "#5a3a1e");
  p.rect(116, 40, 26, 22, "#d8d0b8");
  p.rect(119, 43, 20, 14, "#0f2a18");
  const working = scene.state === "WORKING";
  for (let row = 0; row < 4; row++) {
    const len = 4 + Math.floor(hash(row + (working ? cycle(scene.t, 16) : 0)) * 12);
    p.rect(121, 45 + row * 3, len, 1, scene.state === "ALERT" && row === 3 ? "#ff5050" : "#4be37a");
  }
  p.rect(126, 58, 8, 4, "#b8b0a0");
  p.rect(96, 56, 10, 6, "#6c757e");
  p.rect(99, 52, 4, 4, "#6c757e");
  for (let i = 0; i < 5; i++) p.rect(90 + i * 4, 60, 2, 2, "#b38a3c");
}

export function drawPipWorkshop(p: Painter, scene: Scene): void {
  planks(p, 0, 80, "#7a5230", "#5a3a20");
  planks(p, 80, ROOM_H - 80, "#4a3220", "#36241a");
  skyWindow(p, 62, 8, 18, 16, scene.hour);
  pegboard(p);
  const working = scene.state === "WORKING";
  gear(p, 136, 18, 7, "#b38a3c", "#5a3d2b", scene.t, working);
  gear(p, 150, 30, 4, "#8a6a2c", "#5a3d2b", scene.t + 3, working, 6);
  gear(p, 122, 30, 4, "#8a6a2c", "#5a3d2b", scene.t + 5, working, 6);
  bench(p, scene);
  drawCharacter(p, PIP, 66, 67, scene);
  if (working) {
    for (let i = 0; i < 4; i++) {
      if (hash(scene.t * 7 + i) < 0.5) continue;
      p.rect(82 + Math.floor(hash(scene.t + i) * 6), 78 + Math.floor(hash(scene.t * 3 + i) * 6), 1, 1, i % 2 ? "#ffe680" : "#ffb347");
    }
  }
  p.rect(20, 84, 12, 8, "#3a3f46");
  p.rect(22, 82, 8, 2, "#c62832");
  statusLamp(p, 100, 12, scene.state, scene.t);
  lightsOff(p, scene.state);
  moodBubble(p, 74, 64, scene.state, scene.t);
  p.rect(0, ROOM_H - 1, ROOM_W, 1, "#2a1a10");
}
