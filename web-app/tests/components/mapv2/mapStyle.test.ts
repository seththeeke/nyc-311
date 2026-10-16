import { describe, expect, it } from "vitest";
import { BASE_SOURCE, buildMapStyle, OPENFREEMAP_TILEJSON, PALETTES } from "../../../src/components/mapv2/mapStyle";

describe("buildMapStyle", () => {
  it.each(["DARK", "LIGHT"] as const)("builds a %s style over OpenFreeMap with extruded buildings", (theme) => {
    const style = buildMapStyle(theme);
    expect(style.sources[BASE_SOURCE]).toEqual({ type: "vector", url: OPENFREEMAP_TILEJSON });
    const building = style.layers.find((l) => l.id === "building-3d");
    expect(building).toMatchObject({ type: "fill-extrusion", minzoom: 13 });
    expect(style.layers[0]).toMatchObject({ id: "background", paint: { "background-color": PALETTES[theme].background } });
    expect(style.sky?.["sky-color"]).toBe(PALETTES[theme].sky);
  });

  it("keeps ['zoom'] at the top level of every road width (MapLibre rejects it nested)", () => {
    const roads = buildMapStyle("DARK").layers.filter((l) => l.id.startsWith("road-"));
    expect(roads).toHaveLength(3);
    for (const road of roads) {
      const width = (road as { paint: { "line-width": unknown[] } }).paint["line-width"];
      expect(width[0]).toBe("interpolate");
      expect(width[2]).toEqual(["zoom"]);
    }
  });

  it("draws place labels after the buildings", () => {
    const ids = buildMapStyle("LIGHT").layers.map((l) => l.id);
    expect(ids.indexOf("place-label")).toBeGreaterThan(ids.indexOf("building-3d"));
  });
});
