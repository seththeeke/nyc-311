import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { lightsOff, moodBubble, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { REX } from "../sprites/rex.ts";

/* Rex's mech hangar: riveted steel, hazard stripes, a giant mech leg in its bay and a wall of review monitors. Working, the visor glows, the beacon spins and the screens scroll diffs with ticks and crosses. */

function panels(p: Painter): void {
  p.rect(0, 0, ROOM_W, 80, "#3a4048");
  for (let x = 0; x < ROOM_W; x += 20) {
    p.rect(x, 0, 1, 80, "#2c3138");
    for (let y = 4; y < 80; y += 12) p.rect(x + 3, y, 1, 1, "#6c757e");
  }
  for (let x = 0; x < ROOM_W; x += 8) {
    p.rect(x, 72, 4, 6, "#e2b33c");
    p.rect(x + 4, 72, 4, 6, "#1d1f22");
  }
  p.rect(0, 80, ROOM_W, ROOM_H - 80, "#2c3138");
  for (let x = 0; x < ROOM_W; x += 16) p.rect(x, 80, 1, ROOM_H - 80, "#23272d");
}

function monitors(p: Painter, scene: Scene): void {
  for (let i = 0; i < 3; i++) {
    const x = 6 + i * 28;
    p.rect(x, 10, 24, 18, "#1d1f22");
    p.rect(x + 2, 12, 20, 14, scene.state === "ALERT" ? "#3a0a0e" : "#0c1a14");
    for (let row = 0; row < 4; row++) {
      const offset = scene.state === "WORKING" ? cycle(scene.t, 20) : 0;
      const seed = i * 11 + row + offset;
      p.rect(x + 4, 14 + row * 3, 3 + Math.floor(hash(seed) * 10), 1, hash(seed + 3) > 0.7 ? "#ffb347" : "#4be37a");
      if (scene.state === "WORKING") p.rect(x + 19, 14 + row * 3, 1, 1, hash(seed + 5) > 0.3 ? "#4be37a" : "#ff5050");
    }
  }
}

function mechLeg(p: Painter, scene: Scene): void {
  p.rect(118, 8, 30, 30, "#5a6168");
  p.rect(122, 12, 22, 22, "#4a5058");
  p.rect(126, 38, 14, 22, "#5a6168");
  p.rect(112, 60, 42, 14, "#5a6168");
  p.rect(112, 60, 42, 2, "#9aa3ad");
  p.rect(130, 20, 6, 6, scene.state === "ASLEEP" ? "#5a3a1a" : "#ffb347");
  for (let x = 116; x < 152; x += 6) p.rect(x, 66, 2, 2, "#e2b33c");
}

export function drawRexHangar(p: Painter, scene: Scene): void {
  panels(p);
  monitors(p, scene);
  mechLeg(p, scene);
  if (scene.state === "WORKING") {
    const sweep = cycle(scene.t, 4);
    p.rect(96, 0, 8, 4, "#ffb347");
    p.rect(96 + (sweep - 2) * 6, 4, 10, 2, "rgba(255,179,71,0.35)");
  } else {
    p.rect(96, 0, 8, 4, "#7a5a2a");
  }
  drawCharacter(p, REX, 62, 58, scene);
  p.rect(28, 72, 60, 8, "#5a6168");
  p.rect(28, 72, 60, 1, "#9aa3ad");
  p.rect(30, 80, 4, 12, "#3e444a");
  p.rect(82, 80, 4, 12, "#3e444a");
  for (let i = 0; i < 6; i++) p.rect(34 + i * 8, 75, 4, 2, ["#4be37a", "#ffb347", "#2b8fb3"][i % 3]);
  statusLamp(p, 104, 14, scene.state, scene.t);
  lightsOff(p, scene.state);
  moodBubble(p, 70, 56, scene.state, scene.t);
}
