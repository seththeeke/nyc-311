import { AdditiveBlending, Color, DoubleSide, MeshBasicMaterial, MeshPhysicalMaterial, MeshStandardMaterial } from "three";

/*
 * Materials for the executive figures (#146). Unlike the residents'
 * flat-shaded look these are smooth and physically based, lit by the
 * team studio's environment map, so metal, cloth and glass read apart.
 */

interface SurfaceOptions {
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  opacity?: number;
  doubleSided?: boolean;
}

/** Cloth, skin, paint: smooth, mostly rough, not metallic. */
export function satin(color: string, options: SurfaceOptions = {}): MeshStandardMaterial {
  const opacity = options.opacity ?? 1;
  return new MeshStandardMaterial({
    color: new Color(color),
    roughness: options.roughness ?? 0.62,
    metalness: options.metalness ?? 0,
    emissive: options.emissive ? new Color(options.emissive) : new Color(0, 0, 0),
    emissiveIntensity: options.emissiveIntensity ?? 1,
    transparent: opacity < 1,
    opacity,
    side: options.doubleSided ? DoubleSide : undefined,
  });
}

/** Polished or worn metal; `roughness` 0.2 is a mirror-ish brass, 0.5 brushed steel. */
export function metal(color: string, roughness = 0.32): MeshStandardMaterial {
  return satin(color, { roughness, metalness: 0.9 });
}

/** Lacquered surfaces with a clear coat over the colour: armour paint, enamel, leather polish. */
export function lacquer(color: string, roughness = 0.4): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({ color: new Color(color), roughness, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.15 });
}

/** Clear glass or crystal, tinted. */
export function glass(color: string, opacity = 0.35): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: new Color(color),
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    transparent: true,
    opacity,
    depthWrite: false,
  });
}

/** Something that gives off light: a lit surface that still has a shape. */
export function lamp(color: string, intensity = 1.6): MeshStandardMaterial {
  return satin(color, { emissive: color, emissiveIntensity: intensity, roughness: 0.3 });
}

/** Pure light with no surface: beams, halos, sparkles. */
export function halo(color: string, opacity: number): MeshBasicMaterial {
  return new MeshBasicMaterial({ color: new Color(color), transparent: true, opacity, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
}
