import { Group, SphereGeometry, type BufferGeometry } from "three";
import { CLOTH, DETAIL, HAIR } from "../../../residents/models/residentPalette";
import { onHead } from "../kit/teamFace";
import { satin } from "../kit/teamMaterials";
import { lathe, lock, part, ring } from "../kit/teamShapes";

/*
 * Sable's head (#146): short dark hair, side-parted and combed back, with
 * sideburns; a day of stubble along the jaw; and a charcoal fedora with a
 * pinched crown, the brim snapped down at the front and up at the back,
 * a black band and a bow.
 */

const HAIR_SATIN = satin(HAIR.BLACK, { roughness: 0.42 });

/* Pinches the crown's front and dents its top, the fedora's shape. */
function pinch(geometry: BufferGeometry, height: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const up = Math.max(0, y / height);
    const a = Math.atan2(z, x);
    const front = Math.max(0, Math.cos(a));
    position.setZ(i, z * (1 - 0.22 * up * up * front));
    position.setY(i, y - 0.035 * up ** 3 * (0.6 + 0.4 * Math.cos(2 * a)) * (1 - Math.abs(Math.sin(a)) * 0.5));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/* Snaps the brim down at the front and up at the back and sides. */
function snap(geometry: BufferGeometry, radius: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const [x, y, z] = [position.getX(i), position.getY(i), position.getZ(i)];
    const out = Math.max(0, (Math.hypot(x, z) - radius * 0.62) / (radius * 0.4));
    const a = Math.atan2(z, x);
    position.setY(i, y + out * out * 0.04 * (Math.cos(a) < 0.3 ? 1 : -1.1 * Math.cos(a)));
  }
  geometry.computeVertexNormals();
  return geometry;
}

/** The fedora, on its own pivot so the brim can be tipped; add it to the head. */
export function buildFedora(r: number): Group {
  const hat = new Group();
  hat.position.set(-0.005, r * 0.6, 0);
  hat.rotation.z = -0.1;
  hat.userData.restY = hat.position.y;
  const felt = satin(CLOTH.CHARCOAL, { roughness: 0.78, doubleSided: true });
  const brim = r * 1.42;
  hat.add(part(snap(lathe([[r * 0.9, 0.012], [brim * 0.98, 0.006], [brim, 0.0], [brim * 0.98, -0.006], [r * 0.9, -0.004]], 72), brim), felt, [0, 0, 0], undefined, [1.1, 1, 1]));
  hat.add(part(pinch(lathe([[r * 0.93, 0.0], [r * 0.92, 0.06], [r * 0.88, 0.13], [r * 0.74, 0.18], [r * 0.4, 0.2], [0.001, 0.195]], 64), 0.2), felt, [0, 0.005, 0], undefined, [1.1, 1, 1]));
  hat.add(part(lathe([[r * 0.935, 0.012], [r * 0.93, 0.048]], 64), satin(DETAIL.EYE, { roughness: 0.4 }), [0, 0.005, 0], undefined, [1.1, 1, 1]));
  const bow = new Group();
  bow.position.set(-r * 0.15, 0.03, r * 0.9);
  bow.add(part(ring(0.012, 0.005, Math.PI * 2, 6, 16), satin(DETAIL.EYE, { roughness: 0.4 }), [0, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.5]));
  bow.add(part(ring(0.012, 0.005, Math.PI * 2, 6, 16), satin(DETAIL.EYE, { roughness: 0.4 }), [-0.02, 0, 0], [0, 0, Math.PI / 2], [1, 1, 0.5]));
  hat.add(bow);
  return hat;
}

/** Short side-parted hair, sideburns and stubble, on a head of radius `r`. */
export function groomSable(head: Group, r: number): void {
  head.add(part(new SphereGeometry(r + 0.01, 48, 24, Math.PI * 1.35, Math.PI * 1.3, 0, Math.PI * 0.56), HAIR_SATIN, [-0.01, 0.004, 0]));
  head.add(part(new SphereGeometry(r + 0.011, 48, 12, 0, Math.PI * 2, 0, Math.PI * 0.24), HAIR_SATIN, [-0.004, 0.006, 0]));
  for (let i = 0; i < 6; i++) {
    const across = -0.5 + i * 0.2;
    head.add(part(lock([onHead(r, 0.55, across, 0.0), onHead(r, 0.72, across + 0.25, 0.022), onHead(r, 0.85, across + 0.6, 0.012)], 0.03, 0.008, 10), HAIR_SATIN));
  }
  for (const side of [1, -1]) {
    head.add(part(lock([onHead(r, 0.3, side * 1.02, 0.003), onHead(r, 0.0, side * 1.04, 0.006), onHead(r, -0.22, side * 1.0, 0.004)], 0.03, 0.02, 10), HAIR_SATIN));
  }
  const stubble = satin(HAIR.BLACK, { opacity: 0.09, roughness: 0.9 });
  head.add(part(new SphereGeometry(r + 0.003, 48, 10, Math.PI * 0.64, Math.PI * 0.72, Math.PI * 0.73, Math.PI * 0.14), stubble));
}
