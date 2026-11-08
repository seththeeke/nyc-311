import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { lightsOff, moodBubble, skyColors, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { KESTREL } from "../sprites/kestrel.ts";

/* Kid Kestrel's rooftop: the city skyline with lit windows, a water tower and a signal lamp. Working, the cape streams in the wind and the tablet shows a fresh green build. */

export function drawKestrelRooftop(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  const sky = skyColors(scene.hour);
  p.rect(0, 0, ROOM_W, 40, sky.top);
  p.rect(0, 40, ROOM_W, 40, sky.bottom);
  for (let i = 0; i < 12; i++) {
    const w = 10 + Math.floor(hash(i) * 10);
    const h = 20 + Math.floor(hash(i + 30) * 40);
    const x = i * 14 - 4;
    p.rect(x, 80 - h, w, h, "#232a3a");
    for (let wy = 80 - h + 3; wy < 76; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) {
      if (hash(wx * 3 + wy) > (sky.night ? 0.45 : 0.85)) p.rect(wx, wy, 2, 2, "#ffe680");
    }
  }
  p.rect(124, 30, 18, 14, "#6e4a2f");
  p.rect(126, 44, 2, 20, "#4a3020");
  p.rect(138, 44, 2, 20, "#4a3020");
  p.rect(0, 80, ROOM_W, ROOM_H - 80, "#4b5563");
  p.rect(0, 78, ROOM_W, 4, "#6c757e");
  p.rect(20, 66, 12, 12, "#33363b");
  p.rect(22, 62, 8, 4, state === "ASLEEP" ? "#5a4a20" : "#ffe680");
  if (state === "WORKING") {
    for (let i = 0; i < 4; i++) p.rect(54 - cycle(t + i * 2, 8) * 3, 70 + i * 3, 4, 1, "rgba(255,255,255,0.5)");
    p.rect(56 + cycle(t, 2), 72, 4, 6, "#e0782d");
  }
  drawCharacter(p, KESTREL, 60, 70, scene);
  statusLamp(p, 146, 70, state, t);
  lightsOff(p, state);
  moodBubble(p, 66, 68, state, t);
}
