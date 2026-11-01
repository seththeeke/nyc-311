import { CylinderGeometry, Group } from "three";
import { DETAIL, FICTION, HERO } from "../../../residents/models/residentPalette";
import { lacquer, metal, satin } from "../kit/teamMaterials";
import { ball, lathe, part, ring, rounded, tube } from "../kit/teamShapes";

/*
 * Penny Platen's body (#146): a 1950s portable typewriter in teal enamel,
 * with four rows of round keys, the fan of type bars, two ribbon spools
 * and the carriage on top. Faces +x; y is up from the bottom of the case.
 */

export interface TypewriterParts {
  body: Group;
  keys: Group[];
  carriage: Group;
}

function key(): Group {
  const cap = new Group();
  cap.add(part(new CylinderGeometry(0.006, 0.006, 0.05, 8), metal(DETAIL.STEEL, 0.4), [0, -0.025, 0]));
  cap.add(part(new CylinderGeometry(0.021, 0.021, 0.012, 20), satin(FICTION.KEY, { roughness: 0.3 })));
  cap.add(part(ring(0.021, 0.004, Math.PI * 2, 6, 24), metal(DETAIL.STEEL, 0.25), [0, 0.002, 0]));
  return cap;
}

function keyboard(body: Group, keys: Group[]): void {
  for (let row = 0; row < 4; row++) {
    const count = row === 0 ? 9 : 10;
    for (let i = 0; i < count; i++) {
      const cap = key();
      cap.position.set(0.21 - row * 0.05, 0.17 + row * 0.03, (i - (count - 1) / 2) * 0.047 + (row % 2) * 0.012);
      cap.rotation.z = 0.35;
      body.add(cap);
      keys.push(cap);
    }
  }
  body.add(part(rounded(0.03, 0.014, 0.3, 0.007), satin(FICTION.KEY, { roughness: 0.3 }), [0.25, 0.15, 0]));
}

function typeBars(body: Group): void {
  const steel = metal(DETAIL.STEEL, 0.3);
  for (let i = 0; i < 21; i++) {
    const angle = Math.PI * (0.08 + (i / 20) * 0.84);
    const bar = part(rounded(0.006, 0.11, 0.004, 0.002), steel, [0.0, 0.3, Math.cos(angle) * 0.08]);
    bar.rotation.set(-(angle - Math.PI / 2), 0, -0.25);
    bar.position.y = 0.27 + Math.sin(angle) * 0.04;
    body.add(bar);
  }
  body.add(part(ring(0.09, 0.006, Math.PI, 6, 24), metal(FICTION.BRASS, 0.25), [0.02, 0.27, 0], [0, 0, Math.PI / 2 - 0.25]));
}

function spools(body: Group): void {
  for (const side of [1, -1]) {
    const spool = new Group();
    spool.position.set(-0.04, 0.35, side * 0.2);
    spool.add(part(new CylinderGeometry(0.045, 0.045, 0.03, 24), satin(side > 0 ? HERO.RED : HERO.WEB, { roughness: 0.7 })));
    spool.add(part(lathe([[0.001, 0.016], [0.05, 0.016], [0.052, 0.02], [0.012, 0.026], [0.001, 0.03]], 24), metal(DETAIL.STEEL, 0.25)));
    body.add(spool);
  }
}

function buildCarriage(): Group {
  const carriage = new Group();
  carriage.position.set(-0.15, 0.42, 0);
  const rubber = satin(HERO.WEB, { roughness: 0.85 });
  carriage.add(part(new CylinderGeometry(0.055, 0.055, 0.6, 32), rubber, [0, 0, 0], [Math.PI / 2, 0, 0]));
  for (const side of [1, -1]) {
    const knob = lathe([[0.001, 0], [0.045, 0], [0.05, 0.02], [0.046, 0.045], [0.02, 0.055], [0.001, 0.056]], 28);
    carriage.add(part(knob, lacquer(FICTION.KEY, 0.3), [0, 0, side * 0.3], [side * Math.PI / 2, 0, 0]));
  }
  carriage.add(part(new CylinderGeometry(0.006, 0.006, 0.56, 10), metal(DETAIL.STEEL, 0.2), [0.065, 0.03, 0], [Math.PI / 2, 0, 0]));
  for (const z of [0.12, -0.12]) carriage.add(part(new CylinderGeometry(0.012, 0.012, 0.025, 14), satin(HERO.WEB), [0.067, 0.03, z], [Math.PI / 2, 0, 0]));
  carriage.add(part(rounded(0.05, 0.02, 0.66, 0.008), metal(DETAIL.STEEL, 0.25), [0, -0.06, 0]));
  /* The carriage-return lever on the left end, chrome with a ball grip. */
  carriage.add(part(tube([[0, 0.02, 0.33], [0.06, 0.05, 0.36], [0.14, 0.06, 0.37], [0.2, 0.05, 0.36]], 0.007, 8), metal(DETAIL.STEEL, 0.15)));
  carriage.add(part(ball(0.016, 16, 12), lacquer(HERO.RED, 0.3), [0.2, 0.05, 0.36]));
  return carriage;
}

/** The whole machine: case, keys, type bars, spools and carriage. The keys are returned so the stage can type on them. */
export function buildTypewriter(): TypewriterParts {
  const body = new Group();
  const enamel = lacquer(FICTION.TYPEWRITER, 0.3);
  body.add(part(rounded(0.5, 0.16, 0.6, 0.05, 4), enamel, [0, 0.08, 0]));
  body.add(part(rounded(0.3, 0.16, 0.56, 0.05, 4), enamel, [-0.1, 0.24, 0]));
  body.add(part(rounded(0.2, 0.05, 0.6, 0.02), satin(HERO.WEB, { roughness: 0.6 }), [0.11, 0.15, 0], [0, 0, 0.35]));
  body.add(part(rounded(0.012, 0.04, 0.16, 0.006), metal(FICTION.BRASS, 0.2), [0.252, 0.06, 0]));
  for (const z of [0.2, -0.2]) body.add(part(ball(0.012, 12, 8), metal(DETAIL.STEEL, 0.3), [0.25, 0.06, z]));
  for (const [x, z] of [[0.2, 0.25], [0.2, -0.25], [-0.2, 0.25], [-0.2, -0.25]]) {
    body.add(part(new CylinderGeometry(0.025, 0.03, 0.02, 16), satin(HERO.WEB), [x, -0.008, z]));
  }
  const keys: Group[] = [];
  keyboard(body, keys);
  typeBars(body);
  spools(body);
  const carriage = buildCarriage();
  body.add(carriage);
  return { body, keys, carriage };
}
