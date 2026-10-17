import { Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MODEL_COLOURS } from "../../../../src/components/residents/models/residentPalette";
import { RESIDENT_MODELS, buildResidentModel } from "../../../../src/components/residents/models/residentModels";
import { MOCK_RESIDENT_PERSONAS } from "../../../../src/test-data/residentPersonas";

/* Style guide budget (Appendix P): a resident is a small, cheap model. */
const TRIANGLE_BUDGET = 3000;

function meshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh) found.push(node);
  });
  return found;
}

function triangles(root: Object3D): number {
  return meshes(root).reduce((sum, mesh) => {
    const geometry = mesh.geometry;
    return sum + (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
  }, 0);
}

describe.each(Object.keys(RESIDENT_MODELS))("resident model %s", (key) => {
  const rig = buildResidentModel(key)!;

  it("is a full rig: torso, head, both arms and both legs", () => {
    for (const part of [rig.torso, rig.head, rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg]) expect(part).toBeDefined();
    expect(rig.head.children.length).toBeGreaterThan(2);
  });

  it(`stays under ${TRIANGLE_BUDGET} triangles`, () => {
    const count = triangles(rig.root);
    expect(count).toBeGreaterThan(100);
    expect(count).toBeLessThanOrEqual(TRIANGLE_BUDGET);
  });

  it("uses only palette colours", () => {
    const allowed = new Set(MODEL_COLOURS.map((colour) => colour.toLowerCase()));
    for (const mesh of meshes(rig.root)) {
      expect(allowed).toContain(`#${(mesh.material as MeshStandardMaterial).color.getHexString()}`);
    }
  });
});

describe("buildResidentModel", () => {
  it("has a model for every sample resident and none for an unknown or missing key", () => {
    for (const persona of MOCK_RESIDENT_PERSONAS) expect(buildResidentModel(persona.model_key)).not.toBeNull();
    expect(buildResidentModel("oak")).toBeNull();
    expect(buildResidentModel(null)).toBeNull();
  });

  it("builds a fresh model each time, so a disposed one is never reused", () => {
    expect(buildResidentModel("juniper")!.root).not.toBe(buildResidentModel("juniper")!.root);
  });
});
