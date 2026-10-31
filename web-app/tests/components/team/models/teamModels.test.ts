import { Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MODEL_COLOURS } from "../../../../src/components/residents/models/residentPalette";
import { buildResidentModel } from "../../../../src/components/residents/models/residentModels";
import { TEAM_MODELS } from "../../../../src/components/team/models/teamModels";
import { TEAM_ROSTER } from "../../../../src/components/team/teamRoster";

/* Same budget as a resident (Appendix P): executives share the body and the style. */
const TRIANGLE_BUDGET = 3000;

function meshes(root: Object3D): Mesh[] {
  const found: Mesh[] = [];
  root.traverse((node) => {
    if (node instanceof Mesh) found.push(node);
  });
  return found;
}

function triangles(root: Object3D): number {
  return meshes(root).reduce((sum, mesh) => sum + (mesh.geometry.index ? mesh.geometry.index.count : mesh.geometry.attributes.position.count) / 3, 0);
}

describe.each(Object.keys(TEAM_MODELS))("team model %s", (key) => {
  const rig = buildResidentModel(key)!;

  it("is a full rig with props on the head and in the hand", () => {
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
    for (const mesh of meshes(rig.root)) expect(allowed).toContain(`#${(mesh.material as MeshStandardMaterial).color.getHexString()}`);
  });
});

describe("TEAM_MODELS", () => {
  it("has a model for every agent on the roster and nothing else; the human has none", () => {
    const keys = TEAM_ROSTER.flatMap((member) => (member.model_key ? [member.model_key] : []));
    expect(Object.keys(TEAM_MODELS).sort()).toEqual([...keys].sort());
    for (const member of TEAM_ROSTER) expect(member.model_key === null).toBe(member.kind === "HUMAN");
  });
});
