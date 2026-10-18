import { describe, expect, it, vi } from "vitest";
import { AdditiveBlending, BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial } from "three";
import { approachAngle, box, createPuffPool, disposeObject, glow, mesh, place, solid } from "../../../src/components/three/threeKit";

describe("materials", () => {
  it("solid is flat-shaded with sensible defaults and honours options", () => {
    const plain = solid("#ff0000");
    expect(plain.flatShading).toBe(true);
    expect(plain.roughness).toBe(0.65);
    expect(plain.transparent).toBe(false);
    const lit = solid("#ff0000", { emissive: "#00ff00", emissiveIntensity: 2, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.4 });
    expect(lit.emissive.getHexString()).toBe("00ff00");
    expect([lit.emissiveIntensity, lit.roughness, lit.metalness, lit.opacity]).toEqual([2, 0.1, 0.9, 0.4]);
  });

  it("glow is additive, transparent and doesn't write depth", () => {
    const material = glow("#ffffff", 0.3);
    expect(material.blending).toBe(AdditiveBlending);
    expect(material.depthWrite).toBe(false);
    expect(material.opacity).toBe(0.3);
  });
});

describe("placement helpers", () => {
  it("place, box and mesh position their objects", () => {
    expect(place(new Group(), 1, 2, 3).position.toArray()).toEqual([1, 2, 3]);
    expect(box(1, 1, 1, solid("#fff"), [4, 5, 6]).position.toArray()).toEqual([4, 5, 6]);
    expect(box(1, 1, 1, solid("#fff")).position.toArray()).toEqual([0, 0, 0]);
    expect(mesh(new BoxGeometry(), solid("#fff")).position.toArray()).toEqual([0, 0, 0]);
  });
});

describe("createPuffPool", () => {
  it("staggers puffs through their life and fades them by intensity", () => {
    const pool = createPuffPool({ count: 4, color: "#ccc", size: 0.2, growTo: 3, rise: [1, 2, 0], lifetimeSeconds: 2, maxOpacity: 0.5 });
    pool.update(0.5, 1);
    expect(pool.group.visible).toBe(true);
    const puffs = pool.group.children as Mesh[];
    expect(puffs).toHaveLength(4);
    const lives = puffs.map((p) => p.position.y / 2);
    expect(new Set(lives.map((l) => l.toFixed(2))).size).toBe(4);
    expect((puffs[0].material as MeshStandardMaterial).opacity).toBeGreaterThan(0);
    pool.update(0.5, 0);
    expect(pool.group.visible).toBe(false);
    expect((puffs[0].material as MeshStandardMaterial).opacity).toBe(0);
  });

  it("uses additive glow materials when asked", () => {
    const pool = createPuffPool({ count: 1, color: "#fc0", size: 0.1, growTo: 1, rise: [0, 1, 0], lifetimeSeconds: 1, maxOpacity: 1, additive: true });
    expect((pool.group.children[0] as Mesh).material).toBeInstanceOf(MeshBasicMaterial);
  });
});

describe("disposeObject", () => {
  it("disposes every mesh's geometry and single or multiple materials", () => {
    const root = new Group();
    const single = box(1, 1, 1, solid("#fff"));
    const multi = new Mesh(new BoxGeometry(), [solid("#fff"), solid("#000")]);
    root.add(single, multi);
    const geometrySpy = vi.spyOn(single.geometry, "dispose");
    const materialSpy = vi.spyOn(single.material as MeshStandardMaterial, "dispose");
    const multiSpies = (multi.material as MeshStandardMaterial[]).map((m) => vi.spyOn(m, "dispose"));
    disposeObject(root);
    expect(geometrySpy).toHaveBeenCalled();
    expect(materialSpy).toHaveBeenCalled();
    multiSpies.forEach((spy) => expect(spy).toHaveBeenCalled());
  });
});

describe("approachAngle", () => {
  it("turns the short way round and clamps the factor", () => {
    expect(approachAngle(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(approachAngle(3, -3, 1)).toBeCloseTo(3 + (2 * Math.PI - 6));
    expect(approachAngle(0, 1, 5)).toBeCloseTo(1);
    expect(approachAngle(0, 1, -1)).toBe(0);
  });
});
