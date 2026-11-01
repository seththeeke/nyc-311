import { Mesh, type MeshStandardMaterial, type Object3D } from "three";
import { describe, expect, it } from "vitest";
import { MODEL_COLOURS } from "../../../../src/components/residents/models/residentPalette";
import { buildResidentModel } from "../../../../src/components/residents/models/residentModels";
import { poseTeam } from "../../../../src/components/team/models/kit/teamMotion";
import { TEAM_MODELS, isTeamModel } from "../../../../src/components/team/models/teamModels";
import { TEAM_ROSTER } from "../../../../src/components/team/teamRoster";

/*
 * The executives are drawn at far higher detail than the residents (#146):
 * smooth geometry, real hands and faces. One is on stage at a time, so the
 * budget is per figure, not per page.
 */
const TRIANGLE_BUDGET = 150_000;

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
  const rig = TEAM_MODELS[key]();

  it("is a full rig with hands, grips and props on the head", () => {
    for (const part of [rig.torso, rig.head, rig.leftArm, rig.rightArm, rig.leftLeg, rig.rightLeg, rig.leftHand, rig.rightHand, rig.leftGrip, rig.rightGrip, rig.leftForearm, rig.rightForearm]) {
      expect(part).toBeDefined();
    }
    expect(rig.head.children.length).toBeGreaterThan(2);
    expect(buildResidentModel(key)).not.toBeNull();
  });

  it(`is detailed, but stays under ${TRIANGLE_BUDGET} triangles`, () => {
    const count = triangles(rig.root);
    expect(count).toBeGreaterThan(20_000);
    expect(count).toBeLessThanOrEqual(TRIANGLE_BUDGET);
  });

  it("uses only palette colours", () => {
    const allowed = new Set(MODEL_COLOURS.map((colour) => colour.toLowerCase()));
    for (const mesh of meshes(rig.root)) expect(allowed).toContain(`#${(mesh.material as MeshStandardMaterial).color.getHexString()}`);
  });

  it("performs a signature loop that starts and ends at rest, with its root on the floor", () => {
    expect(rig.cycle).toBeGreaterThan(5);
    expect(rig.still).toBeGreaterThan(0);
    expect(rig.still).toBeLessThan(rig.cycle ?? 0);
    const rest = () => [rig.body.position.y, rig.leftArm.rotation.z, rig.rightArm.rotation.z, rig.head.rotation.y];
    poseTeam(rig, 0);
    const start = rest();
    for (let i = 1; i < 120; i++) poseTeam(rig, ((rig.cycle ?? 0) * i) / 120);
    poseTeam(rig, (rig.cycle ?? 0) - 1e-6);
    rest().forEach((value, i) => expect(value).toBeCloseTo(start[i], 3));
    expect(rig.root.position.toArray()).toEqual([0, 0, 0]);
  });

  it("moves away from rest during the performance", () => {
    poseTeam(rig, rig.still ?? 0);
    const posed = rig.rightArm.rotation.z + rig.leftArm.rotation.z + rig.body.position.y + rig.head.rotation.z;
    poseTeam(rig, 0);
    expect(posed).not.toBeCloseTo(rig.rightArm.rotation.z + rig.leftArm.rotation.z + rig.body.position.y + rig.head.rotation.z, 2);
  });
});

describe("TEAM_MODELS", () => {
  it("has a model for every agent on the roster and nothing else; the human has none", () => {
    const keys = TEAM_ROSTER.flatMap((member) => (member.model_key ? [member.model_key] : []));
    expect(Object.keys(TEAM_MODELS).sort()).toEqual([...keys].sort());
    for (const member of TEAM_ROSTER) expect(member.model_key === null).toBe(member.kind === "HUMAN");
  });

  it("tells a team key from a resident's or none", () => {
    expect(isTeamModel("penny-platen")).toBe(true);
    expect(isTeamModel("hawthorn")).toBe(false);
    expect(isTeamModel(null)).toBe(false);
  });
});
