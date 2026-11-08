import { ROOM_H, ROOM_W, cycle, hash, type Painter, type Scene } from "../pixelKit.ts";
import { lightsOff, moodBubble, statusLamp } from "../scenery.ts";
import { drawCharacter } from "../sprites/character.ts";
import { ROBOT } from "../sprites/robot.ts";

/* The room for an agent without a persona yet: a server closet of blinking racks and a helpful robot. */
export function drawRobotCloset(p: Painter, scene: Scene): void {
  const { t, state } = scene;
  p.rect(0, 0, ROOM_W, 80, "#20262e");
  p.rect(0, 80, ROOM_W, ROOM_H - 80, "#2c3440");
  for (let x = 0; x < ROOM_W; x += 12) p.rect(x, 80, 1, ROOM_H - 80, "#252c36");
  for (const rx of [8, 28, 108, 128]) {
    p.rect(rx, 14, 18, 66, "#33363b");
    for (let y = 18; y < 78; y += 6) {
      p.rect(rx + 2, y, 14, 4, "#1d1f22");
      const on = state === "ASLEEP" ? false : hash(rx + y + (state === "WORKING" ? cycle(t, 8) : 0)) > 0.4;
      p.rect(rx + 13, y + 1, 2, 2, on ? "#4be37a" : "#14301e");
    }
  }
  drawCharacter(p, ROBOT, 72, 76, scene);
  statusLamp(p, 78, 8, state, t);
  lightsOff(p, state);
  moodBubble(p, 80, 74, state, t);
}
