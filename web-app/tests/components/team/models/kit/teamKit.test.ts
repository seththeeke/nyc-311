import { Group, MeshBasicMaterial, MeshPhysicalMaterial, Shape } from "three";
import { describe, expect, it } from "vitest";
import { DETAIL, FACE, SKIN } from "../../../../../src/components/residents/models/residentPalette";
import { buildTeamBody, heightAboveFloor, placeUpright } from "../../../../../src/components/team/models/kit/teamBody";
import { buildFace, onHead } from "../../../../../src/components/team/models/kit/teamFace";
import { glass, halo, lacquer, lamp, metal, satin } from "../../../../../src/components/team/models/kit/teamMaterials";
import { extrude, limb, lock, wrapOnSphere } from "../../../../../src/components/team/models/kit/teamShapes";

describe("team materials", () => {
  it("makes cloth, metal, lacquer, glass, lamps and halos", () => {
    expect(satin(SKIN.LIGHT).transparent).toBe(false);
    expect(satin(SKIN.LIGHT, { opacity: 0.5, doubleSided: true }).transparent).toBe(true);
    expect(metal(DETAIL.STEEL).metalness).toBeGreaterThan(0.8);
    expect(lacquer(DETAIL.STEEL)).toBeInstanceOf(MeshPhysicalMaterial);
    expect(glass(DETAIL.LENS).opacity).toBeLessThan(1);
    expect(lamp(DETAIL.LENS).emissiveIntensity).toBeGreaterThan(1);
    expect(halo(DETAIL.LENS, 0.4)).toBeInstanceOf(MeshBasicMaterial);
  });
});

describe("team shapes", () => {
  it("turns a limb from 0 down to -length", () => {
    const geometry = limb(0.4, 0.05, 0.03);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.y).toBeCloseTo(0, 3);
    expect(geometry.boundingBox?.min.y).toBeCloseTo(-0.4, 3);
  });

  it("tapers a lock to a fine tip", () => {
    const geometry = lock([[0, 0, 0], [0, -0.1, 0], [0, -0.2, 0]], 0.05, 0.01);
    geometry.computeBoundingBox();
    expect(geometry.boundingBox?.max.x).toBeCloseTo(0.05, 2);
  });

  it("bends a decal onto a sphere so every point sits at the radius plus its depth", () => {
    const square = new Shape();
    square.moveTo(-0.05, -0.05);
    square.lineTo(0.05, -0.05);
    square.lineTo(0.05, 0.05);
    square.lineTo(-0.05, 0.05);
    const geometry = wrapOnSphere(extrude(square, 0.01, 0), 0.3);
    const position = geometry.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const r = Math.hypot(position.getX(i), position.getY(i), position.getZ(i));
      expect(r).toBeGreaterThanOrEqual(0.299);
      expect(r).toBeLessThanOrEqual(0.311);
    }
  });
});

describe("team face and body", () => {
  it("places points on the head by angle", () => {
    expect(onHead(1, 0, 0)).toEqual([1, 0, 0]);
    expect(onHead(1, 0, Math.PI / 2, 1)[2]).toBeCloseTo(2);
  });

  it("builds a face and a body from the defaults", () => {
    expect(buildFace(0.24, { skin: SKIN.LIGHT, iris: FACE.IRIS_BROWN, brows: DETAIL.EYE }).children.length).toBeGreaterThan(5);
    const rig = buildTeamBody({ height: 1, skin: SKIN.LIGHT, top: DETAIL.STEEL, bottom: DETAIL.STEEL, shoes: DETAIL.SHOE, face: { skin: SKIN.LIGHT, iris: FACE.IRIS_BROWN, brows: DETAIL.EYE } });
    expect(heightAboveFloor(rig, rig.leftGrip)).toBeGreaterThan(0.2);
    const item = new Group();
    placeUpright(rig, rig.leftForearm, item, [0, -0.1, 0]);
    expect(item.parent).toBe(rig.leftForearm);
  });
});
