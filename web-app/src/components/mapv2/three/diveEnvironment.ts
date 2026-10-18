import { Color, DirectionalLight, Fog, Group, HemisphereLight, PlaneGeometry, PointLight, type Scene } from "three";
import type { ThemeName } from "../../../models/theme";
import { buildBuilding, buildHydrant, buildStreetLamp, buildTree } from "./props";
import { box, mesh, solid } from "../../three/threeKit";

/*
 * The stylised New York block the dive-in plays out on: a two-lane
 * street along x, brownstones behind it and storefronts in front (a
 * cutaway, like a diorama), trees, lamps and a hydrant. Night under
 * DARK, a soft day under LIGHT.
 */

export const ROAD_HALF_WIDTH = 6;
const SIDEWALK_WIDTH = 4;
const BLOCK_HALF_LENGTH = 48;

interface Mood {
  sky: string;
  fogNear: number;
  fogFar: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  sunIntensity: number;
  litFraction: number;
  lampIntensity: number;
}

export const MOODS: Record<ThemeName, Mood> = {
  DARK: { sky: "#0a1122", fogNear: 40, fogFar: 120, hemiSky: "#6f8cff", hemiGround: "#1a1d26", hemiIntensity: 0.9, sunIntensity: 0.6, litFraction: 0.55, lampIntensity: 26 },
  LIGHT: { sky: "#dbe8f6", fogNear: 60, fogFar: 160, hemiSky: "#ffffff", hemiGround: "#8a8f98", hemiIntensity: 1.5, sunIntensity: 2.2, litFraction: 0.12, lampIntensity: 0 },
};

const FACADE_COLORS = ["#8a4b3a", "#a25f45", "#6e3f35", "#b9a58c", "#7d6a5d", "#5d4a4a", "#9c7b63"];

function buildStreet(): Group {
  const street = new Group();
  street.add(mesh(new PlaneGeometry(BLOCK_HALF_LENGTH * 2, ROAD_HALF_WIDTH * 2).rotateX(-Math.PI / 2), solid("#2b2e35", { roughness: 0.95 })));
  for (let x = -BLOCK_HALF_LENGTH + 2; x < BLOCK_HALF_LENGTH; x += 6) {
    street.add(box(3, 0.02, 0.18, solid("#f2c230", { emissive: "#f2c230", emissiveIntensity: 0.25 }), [x, 0.01, 0]));
  }
  for (const z of [-ROAD_HALF_WIDTH + 0.4, ROAD_HALF_WIDTH - 0.4]) {
    street.add(box(BLOCK_HALF_LENGTH * 2, 0.02, 0.14, solid("#e9edf2"), [0, 0.01, z]));
  }
  for (let i = 0; i < 7; i += 1) {
    street.add(box(2.2, 0.02, 0.9, solid("#e9edf2"), [22, 0.012, -ROAD_HALF_WIDTH + 1 + i * 1.65]));
  }
  for (const side of [-1, 1]) {
    const z = side * (ROAD_HALF_WIDTH + SIDEWALK_WIDTH / 2);
    street.add(box(BLOCK_HALF_LENGTH * 2, 0.18, SIDEWALK_WIDTH, solid("#8d939d"), [0, 0.09, z]));
    street.add(box(BLOCK_HALF_LENGTH * 2, 0.2, 0.25, solid("#b7bcc4"), [0, 0.1, side * (ROAD_HALF_WIDTH + 0.12)]));
  }
  return street;
}

function buildFacades(mood: Mood): Group {
  const facades = new Group();
  for (const side of [-1, 1]) {
    let x = -BLOCK_HALF_LENGTH;
    let i = side > 0 ? 0 : 3;
    while (x < BLOCK_HALF_LENGTH) {
      const width = 7 + ((i * 5) % 4) * 1.5;
      const building = buildBuilding({
        width,
        depth: 12,
        /* A cutaway: one-storey storefronts on the camera's side, so the far brownstones and the site stay in view. */
        floors: side > 0 ? 1 : 3 + ((i * 7) % 4),
        color: FACADE_COLORS[i % FACADE_COLORS.length],
        litFraction: mood.litFraction,
        seed: i * 13 + side,
      });
      building.position.set(x + width / 2, 0, side * (ROAD_HALF_WIDTH + SIDEWALK_WIDTH + 6));
      /* Façade windows are built on +z; the near side (+z) turns round to face the street. */
      building.rotation.y = side < 0 ? 0 : Math.PI;
      facades.add(building);
      x += width + 0.4;
      i += 1;
    }
  }
  return facades;
}

function buildFurniture(mood: Mood): Group {
  const furniture = new Group();
  for (const [x, side] of [[-30, 1], [-6, -1], [14, 1], [34, -1]]) {
    const lamp = buildStreetLamp();
    lamp.position.set(x, 0.18, side * (ROAD_HALF_WIDTH + 0.6));
    lamp.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
    furniture.add(lamp);
    if (mood.lampIntensity > 0) {
      const light = new PointLight("#ffd58a", mood.lampIntensity, 18, 1.6);
      light.position.set(x, 5.2, side * (ROAD_HALF_WIDTH - 0.5));
      furniture.add(light);
    }
  }
  for (const [x, side, s] of [[-38, -1, 1.1], [-18, 1, 0.9], [6, -1, 1.2], [26, -1, 1], [42, 1, 0.95]]) {
    const tree = buildTree(s);
    tree.position.set(x, 0.18, side * (ROAD_HALF_WIDTH + 2.4));
    furniture.add(tree);
  }
  const hydrant = buildHydrant();
  hydrant.position.set(9, 0.18, ROAD_HALF_WIDTH + 1);
  furniture.add(hydrant);
  return furniture;
}

/** Populates `scene` with the block, its lighting and atmosphere for `theme`. */
export function buildDiveEnvironment(scene: Scene, theme: ThemeName): void {
  const mood = MOODS[theme];
  scene.background = new Color(mood.sky);
  scene.fog = new Fog(mood.sky, mood.fogNear, mood.fogFar);
  scene.add(new HemisphereLight(mood.hemiSky, mood.hemiGround, mood.hemiIntensity));
  const sun = new DirectionalLight("#fff4e0", mood.sunIntensity);
  sun.position.set(-30, 50, 25);
  scene.add(sun);
  scene.add(buildStreet(), buildFacades(mood), buildFurniture(mood));
}
