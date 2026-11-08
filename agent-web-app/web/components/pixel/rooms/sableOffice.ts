import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { lightsOff, line, moodBubble, skyColors, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { SABLE } from "../sprites/sable.ts";

/* Sable's office after hours: rain on the window behind venetian blinds, a neon sign outside, a case board of pinned clues and red string, a green banker's lamp and a cold coffee. Working, the string draws itself to the next clue. */

function rainyWindow(p: Painter, scene: Scene): void {
  const sky = skyColors(scene.hour);
  p.rect(8, 8, 40, 46, "#2a2420");
  p.rect(10, 10, 36, 42, sky.night ? "#141a2e" : "#5a6a7a");
  p.rect(12, 30, 10, 8, cycle(scene.t, 9) === 0 ? "#5a1a3a" : "#ff4fa0");
  for (let i = 0; i < 14; i++) {
    const x = 10 + Math.floor(hash(i) * 36);
    const y = 10 + ((Math.floor(hash(i + 20) * 42) + cycle(scene.t, 42) * 2) % 40);
    p.rect(x, y, 1, 2, "#8aa0c8");
  }
  for (let y = 12; y < 52; y += 4) p.rect(10, y, 36, 1, "#b9a888");
}

const CLUES: readonly (readonly [number, number])[] = [[112, 16], [140, 14], [124, 34], [146, 40], [110, 44]];

function caseBoard(p: Painter, scene: Scene): void {
  p.rect(104, 8, 52, 50, "#5a3d2b");
  p.rect(106, 10, 48, 46, "#b8875a");
  for (const [x, y] of CLUES) {
    p.rect(x, y, 8, 6, "#e8e1d3");
    p.rect(x + 3, y - 1, 2, 2, "#c62832");
  }
  const progress = scene.state === "WORKING" ? (cycle(scene.t, 16) + 1) / 16 : 1;
  CLUES.slice(0, 4).forEach(([x, y], i) => {
    const [nx, ny] = CLUES[i + 1];
    line(p, x + 4, y, nx + 4, ny, "#c62832", i === 3 ? progress : 1);
  });
}

export function drawSableOffice(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  p.rect(0, 0, ROOM_W, 80, "#24222a");
  p.rect(0, 80, ROOM_W, ROOM_H - 80, "#2e2620");
  for (let x = 0; x < ROOM_W; x += 10) p.rect(x, 80, 1, ROOM_H - 80, "#251f1a");
  rainyWindow(p, scene);
  for (let i = 0; i < 5; i++) p.rect(50 + i * 8, 84 + i * 4, 30, 2, "rgba(185,168,136,0.10)");
  caseBoard(p, scene);
  p.rect(58, 72, 70, 6, "#4a3424");
  p.rect(60, 78, 66, 14, "#3a281c");
  const lampOn = state === "WORKING" || state === "ALERT";
  p.rect(108, 62, 10, 4, "#2f6a3a");
  p.rect(112, 66, 2, 6, "#b38a3c");
  if (lampOn) p.rect(98, 66, 30, 6, "rgba(255,230,140,0.25)");
  p.rect(92, 68, 5, 4, "#e8e1d3");
  if (cycle(t, 6) < 3) p.rect(93, 65 - cycle(t, 3), 1, 2, "rgba(232,225,211,0.6)");
  p.rect(70, 70, 12, 2, "#e8e1d3");
  drawCharacter(p, SABLE, 40, 62, scene);
  statusLamp(p, 56, 10, state, t);
  lightsOff(p, state);
  moodBubble(p, 48, 59, state, t);
}
