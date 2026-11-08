import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { bricks, disc, lightsOff, moodBubble, statusLamp } from "../scenery.ts";
import { BROGAN } from "../sprites/brogan.ts";
import { drawCharacter } from "../sprites/character.ts";

/* Brogan's forge office in the deep: stone walls, a roaring forge, an anvil, a mine cart of ore and the crew roster. Working, the hammer rings on the anvil in showers of sparks. */

function forge(p: Painter, scene: Scene): void {
  p.rect(4, 6, 40, 10, "#3a3a40");
  p.rect(10, 0, 28, 6, "#2e2e34");
  p.rect(6, 40, 36, 30, "#5a5a62");
  p.rect(10, 46, 28, 18, "#1a1010");
  const hot = scene.state === "WORKING" ? 1 : scene.state === "ASLEEP" ? -1 : 0;
  if (hot >= 0) {
    for (let i = 0; i < 6; i++) {
      const h = 4 + Math.floor(hash(scene.t + i) * (6 + hot * 6));
      p.rect(12 + i * 4, 64 - h, 3, h, i % 2 ? "#ff8a2a" : "#ffd04a");
    }
    p.rect(8, 40, 32, 2, "rgba(255,140,40,0.35)");
  } else {
    p.rect(12, 60, 24, 4, "#6a2010");
  }
}

function hammer(p: Painter, scene: Scene, x: number, y: number): void {
  const raised = scene.state === "WORKING" && cycle(scene.t, 2, 2) === 0;
  if (raised) {
    p.rect(x + 14, y - 8, 2, 14, "#5a3d2b");
    p.rect(x + 11, y - 12, 8, 5, "#9aa3ad");
    return;
  }
  if (scene.state === "WORKING") {
    p.rect(x + 16, y + 9, 12, 2, "#5a3d2b");
    p.rect(x + 25, y + 6, 5, 8, "#9aa3ad");
    for (let i = 0; i < 6; i++) p.rect(x + 27 + Math.floor((hash(scene.t * 5 + i) - 0.5) * 16), y + 4 - Math.floor(hash(scene.t + i * 9) * 8), 1, 1, i % 2 ? "#ffe680" : "#ff8a2a");
    return;
  }
  p.rect(x - 4, y + 4, 2, 14, "#5a3d2b");
  p.rect(x - 7, y + 14, 8, 5, "#9aa3ad");
}

export function drawBroganForge(p: Painter, scene: Scene): void {
  bricks(p, 0, 80, "#4a4a52", "#34343a");
  bricks(p, 80, ROOM_H - 80, "#2e2e34", "#232328", 16, 8);
  forge(p, scene);
  p.rect(60, 12, 22, 26, "#c8b890");
  for (let i = 0; i < 5; i++) p.rect(63, 16 + i * 4, 6 + Math.floor(hash(i) * 10), 1, "#5a3d2b");
  p.rect(70, 10, 2, 3, "#9aa3ad");
  p.rect(118, 66, 34, 14, "#6c4a30");
  p.rect(116, 64, 38, 3, "#5a5a62");
  for (const [x, c] of [[122, "#7c8794"], [130, "#e2b33c"], [138, "#7c8794"], [144, "#4ac0e0"]] as const) disc(p, x, 62, 3, c);
  p.rect(120, 80, 6, 6, "#26282c");
  p.rect(144, 80, 6, 6, "#26282c");
  p.rect(150, 10, 1, 12, "#26282c");
  p.rect(147, 22, 7, 8, "#b38a3c");
  p.rect(148, 24, 5, 4, scene.state === "ASLEEP" ? "#5a4a20" : "#ffe680");
  p.rect(94, 78, 22, 5, "#3e444a");
  p.rect(90, 76, 30, 3, "#5a6168");
  p.rect(100, 83, 10, 6, "#3e444a");
  drawCharacter(p, BROGAN, 74, 70, scene);
  hammer(p, scene, 74, 70);
  statusLamp(p, 100, 8, scene.state, scene.t);
  lightsOff(p, scene.state);
  moodBubble(p, 82, 67, scene.state, scene.t);
  p.rect(0, ROOM_H - 1, ROOM_W, 1, "#141418");
}
