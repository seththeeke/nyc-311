import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, THEME_NAMES, ThemeNameSchema } from "../../src/models/theme";

describe("ThemeNameSchema", () => {
  it("accepts every declared theme", () => {
    for (const name of THEME_NAMES) expect(ThemeNameSchema.parse(name)).toBe(name);
  });

  it("rejects unknown and lowercase values", () => {
    expect(ThemeNameSchema.safeParse("dark").success).toBe(false);
    expect(ThemeNameSchema.safeParse("SEPIA").success).toBe(false);
    expect(ThemeNameSchema.safeParse(null).success).toBe(false);
  });

  it("defaults to a valid theme", () => {
    expect(ThemeNameSchema.safeParse(DEFAULT_THEME).success).toBe(true);
  });
});
