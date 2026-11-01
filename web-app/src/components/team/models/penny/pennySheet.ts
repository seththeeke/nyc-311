import { type BufferGeometry, CircleGeometry, Group, type Material, type Mesh, PlaneGeometry } from "three";
import { DETAIL, FACE, FICTION, HERO } from "../../../residents/models/residentPalette";
import { lamp, satin } from "../kit/teamMaterials";
import { ball, part, tube, type Vec3 } from "../kit/teamShapes";

/*
 * Penny's head (#146): the sheet of paper in the carriage, with a 1950s
 * cartoon face printed on it (pie-cut eyes with lashes, an open smile),
 * a red bow on top and the first lines of today's minutes below.
 */

const WIDTH = 0.46;
const HEIGHT = 0.56;
const INK = satin(DETAIL.EYE, { roughness: 0.5 });

/* A sheet that curls back into the platen at the bottom and forward at the top corner. */
function sheet(): PlaneGeometry {
  const geometry = new PlaneGeometry(WIDTH, HEIGHT, 8, 24);
  geometry.rotateY(Math.PI / 2);
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i);
    const z = position.getZ(i);
    const curl = y < -0.2 ? -(((-0.2 - y) / 0.08) ** 2) * 0.03 : 0;
    const flip = y > 0.2 ? ((y - 0.2) / 0.08) ** 2 * 0.025 * (0.6 + z) : 0;
    position.setX(i, curl + flip);
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* Flat print on the paper's face, `lift` in front of it. */
function print(geometry: BufferGeometry, material: Material, y: number, z: number, scale: Vec3 = [1, 1, 1]): Mesh {
  return part(geometry, material, [0.006, y, z], [0, Math.PI / 2, 0], scale);
}

function eyes(head: Group): void {
  for (const side of [1, -1]) {
    const z = side * 0.085;
    head.add(part(ball(0.05, 24, 16), INK, [0.004, 0.08, z], undefined, [0.12, 1.25, 0.8]));
    head.add(part(ball(0.016, 12, 8), lamp(FACE.CATCHLIGHT, 1.2), [0.012, 0.11, z - side * 0.012], undefined, [0.2, 1.4, 0.9]));
    for (let i = 0; i < 3; i++) {
      const a = 0.5 + i * 0.3;
      const base: Vec3 = [0.008, 0.08 + Math.cos(a) * 0.058, z + side * Math.sin(a) * 0.04];
      head.add(part(tube([base, [0.014, base[1] + 0.022, base[2] + side * 0.018]], 0.0035, 6), INK));
    }
    head.add(part(tube([[0.008, 0.16, z - side * 0.035], [0.01, 0.175, z], [0.008, 0.162, z + side * 0.04]], 0.004, 6), INK));
    head.add(print(new CircleGeometry(0.03, 24), satin(FACE.BLUSH, { opacity: 0.7 }), 0.0, side * 0.14));
  }
}

function smile(head: Group): void {
  const mouth = print(new CircleGeometry(0.06, 32, Math.PI, Math.PI), INK, -0.02, 0, [1, 0.75, 1]);
  head.add(mouth);
  head.add(print(new CircleGeometry(0.032, 24, Math.PI, Math.PI), satin(HERO.RED, { roughness: 0.5 }), -0.055, 0, [1, 0.6, 1]));
  const lips: Vec3[] = [-1, -0.5, 0, 0.5, 1].map((t) => [0.009, -0.02 - 0.045 * Math.cos((t * Math.PI) / 2), t * 0.062]);
  head.add(part(tube(lips, 0.005, 8), satin(HERO.RED, { roughness: 0.35 })));
  head.add(part(tube([[0.009, -0.02, -0.066], [0.009, -0.018, 0], [0.009, -0.02, 0.066]], 0.005, 8), satin(HERO.RED, { roughness: 0.35 })));
}

function bow(head: Group): void {
  const ribbon = satin(HERO.RED, { roughness: 0.45 });
  const bowGroup = new Group();
  bowGroup.position.set(0.01, HEIGHT / 2 - 0.02, 0.12);
  bowGroup.rotation.x = -0.35;
  for (const side of [1, -1]) {
    bowGroup.add(part(ball(0.045, 20, 14), ribbon, [0, 0.005, side * 0.045], [side * 0.5, 0, 0], [0.45, 0.7, 1]));
    bowGroup.add(part(ball(0.02, 12, 8), ribbon, [0, -0.04, side * 0.02], [side * 0.3, 0, 0], [0.4, 1.5, 0.6]));
  }
  bowGroup.add(part(ball(0.02, 16, 12), ribbon, [0.005, 0, 0], undefined, [0.7, 1, 1]));
  head.add(bowGroup);
}

/** The head group's children; its origin is the middle of the sheet. */
export function buildSheet(head: Group): void {
  head.add(part(sheet(), satin(FICTION.KEY, { roughness: 0.85, doubleSided: true })));
  eyes(head);
  smile(head);
  bow(head);
  const widths = [0.3, 0.34, 0.22, 0.32];
  widths.forEach((width, i) => head.add(print(new PlaneGeometry(width, 0.008), satin(FICTION.TYPEWRITER, { roughness: 0.6 }), -0.13 - i * 0.022, (0.34 - width) / 2 - 0.02)));
}
