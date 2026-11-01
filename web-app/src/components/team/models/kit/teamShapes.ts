import {
  type BufferGeometry,
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  type Material,
  Mesh,
  type Shape,
  SphereGeometry,
  TorusGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

/*
 * Geometry helpers for the executive figures (#146): turned profiles,
 * swept tubes, rounded boxes, extruded outlines and decals bent onto a
 * sphere. Units are metres; figures face +x with y up, +z to their left.
 */

export type Vec3 = [number, number, number];

export function at<T extends Mesh>(item: T, position: Vec3, rotation: Vec3 = [0, 0, 0], scale: Vec3 = [1, 1, 1]): T {
  item.position.set(...position);
  item.rotation.set(...rotation);
  item.scale.set(...scale);
  return item;
}

export function part(geometry: BufferGeometry, material: Material, position: Vec3 = [0, 0, 0], rotation?: Vec3, scale?: Vec3): Mesh {
  return at(new Mesh(geometry, material), position, rotation, scale);
}

/** A solid turned on a lathe about y: `profile` is [radius, height] pairs from bottom to top. */
export function lathe(profile: [number, number][], segments = 32, phiStart = 0, phiLength = Math.PI * 2): LatheGeometry {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(Math.max(r, 0.0001), y)), segments, phiStart, phiLength);
}

/**
 * A limb hanging down -y from 0 to -length: round at both ends and
 * tapering from `top` to `bottom` radius, like an upper arm or a shin.
 */
export function limb(length: number, top: number, bottom: number, segments = 20): LatheGeometry {
  const profile: [number, number][] = [];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push([bottom * Math.sin(a), -length + bottom * (1 - Math.cos(a))]);
  }
  for (let i = 6; i >= 0; i--) {
    const a = (i / 6) * (Math.PI / 2);
    profile.push([top * Math.sin(a), -top * (1 - Math.cos(a))]);
  }
  return lathe(profile, segments);
}

/** A tube swept through `points` (smoothed), for hair, braids, cables and rubber-hose arms. */
export function tube(points: Vec3[], radius: number, radial = 10, tension = 0.5): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)), false, "catmullrom", tension);
  return new TubeGeometry(curve, Math.max(12, points.length * 8), radius, radial, false);
}

/**
 * A lock of hair or a strand that tapers from `start` to `end` radius
 * along `points`, with a soft rounded tip: beards, moustaches, tufts.
 */
export function lock(points: Vec3[], start: number, end: number, radial = 10): TubeGeometry {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  const segments = Math.max(16, points.length * 8);
  const geometry = new TubeGeometry(curve, segments, 1, radial, false);
  const position = geometry.attributes.position;
  const centre = new Vector3();
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    curve.getPointAt(t, centre);
    const radius = (start + (end - start) * t) * (t > 0.85 ? Math.sqrt(Math.max(0.05, (1 - t) / 0.15)) : 1);
    for (let j = 0; j <= radial; j++) {
      const k = i * (radial + 1) + j;
      position.setXYZ(k, centre.x + (position.getX(k) - centre.x) * radius, centre.y + (position.getY(k) - centre.y) * radius, centre.z + (position.getZ(k) - centre.z) * radius);
    }
  }
  geometry.computeVertexNormals();
  return geometry;
}

export function rounded(width: number, height: number, depth: number, radius = 0.02, segments = 3): RoundedBoxGeometry {
  return new RoundedBoxGeometry(width, height, depth, segments, Math.min(radius, width / 2, height / 2, depth / 2));
}

/** A ball; scale the mesh for an ellipsoid. */
export function ball(radius: number, width = 24, height = 16): SphereGeometry {
  return new SphereGeometry(radius, width, height);
}

/** A ring lying flat in the x-z plane (rotate the mesh to stand it up). */
export function ring(radius: number, thickness: number, arc = Math.PI * 2, radial = 8, tubular = 32): TorusGeometry {
  const geometry = new TorusGeometry(radius, thickness, radial, tubular, arc);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}

/** An outline in the y-z plane, given `depth` along +x, with softened edges. */
export function extrude(shape: Shape, depth: number, bevel = 0.004): ExtrudeGeometry {
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 2, curveSegments: 16 });
  geometry.rotateY(Math.PI / 2);
  return geometry;
}

/**
 * Bends a flat decal from `extrude` round a sphere of `radius` centred at
 * the origin, so a mask or a circlet hugs the head. The decal's z and y
 * become angles across the face (+x); its depth stands off the surface.
 */
export function wrapOnSphere(geometry: BufferGeometry, radius: number): BufferGeometry {
  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i++) {
    const lift = position.getX(i);
    const across = position.getZ(i) / radius;
    const up = position.getY(i) / radius;
    const r = radius + lift;
    position.setXYZ(i, r * Math.cos(up) * Math.cos(across), r * Math.sin(up), r * Math.cos(up) * Math.sin(across));
  }
  geometry.computeVertexNormals();
  return geometry;
}
