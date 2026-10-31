import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ResidentDao } from "../../../dao/resident/residentDao";
import { ValidationError } from "../../../models/errors";
import { buildResidentContent, parseSeeds, syncResidents } from "../../../service/resident/residentSyncService";
import { current, seed } from "../../residentFixtures";

const NOW = new Date("2026-10-17T12:00:00.000Z");

function daoWith(existing: typeof current | null) {
  const dao = { getCurrent: vi.fn().mockResolvedValue(existing), createResident: vi.fn(), addVersion: vi.fn() };
  return { dao, deps: { residentDao: dao as unknown as ResidentDao, now: () => NOW } };
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("buildResidentContent", () => {
  it("adds both prompts and a hash that depends only on content", () => {
    const content = buildResidentContent(seed);
    expect(content.prompt_version).toBe("idea-generator@2");
    expect(content.action_prompt_version).toBe("idea-actioner@1");
    expect(content.action_prompt).toContain("finish_idea");
    expect(content.content_hash).toMatch(/^sha256:[0-9a-f]{64}$/);
    const reordered = Object.fromEntries(Object.entries(seed).reverse()) as typeof seed;
    expect(buildResidentContent(reordered).content_hash).toBe(content.content_hash);
    expect(buildResidentContent({ ...seed, tagline: "Changed" }).content_hash).not.toBe(content.content_hash);
  });
});

describe("parseSeeds", () => {
  it("rejects a malformed seed and two seeds with one persona_id", () => {
    expect(() => parseSeeds([{ ...seed, name: "" }])).toThrow(ValidationError);
    expect(() => parseSeeds([seed, seed])).toThrow("Two resident seeds share persona_id hawthorn");
  });
});

describe("syncResidents", () => {
  it("creates version 1 with zeroed counters for a new resident", async () => {
    const { dao, deps } = daoWith(null);
    await expect(syncResidents([seed], deps)).resolves.toEqual({ hawthorn: "CREATED" });
    const [version, created] = dao.createResident.mock.calls[0];
    expect(version).toMatchObject({ sk: "V#0001", version: 1, created_at: NOW.toISOString() });
    expect(created).toMatchObject({ sk: "CURRENT", version: 1, roster_pk: "ALL", idea_count: 0, last_idea_at: null });
  });

  it("leaves an unchanged resident alone", async () => {
    const { dao, deps } = daoWith(current);
    await expect(syncResidents([seed], deps)).resolves.toEqual({ hawthorn: "UNCHANGED" });
    expect(dao.createResident).not.toHaveBeenCalled();
    expect(dao.addVersion).not.toHaveBeenCalled();
  });

  it("writes the next version for a changed seed", async () => {
    const { dao, deps } = daoWith({ ...current, content_hash: "sha256:old" });
    await expect(syncResidents([seed], deps)).resolves.toEqual({ hawthorn: "NEW_VERSION" });
    const [version, content, at] = dao.addVersion.mock.calls[0];
    expect(version).toMatchObject({ sk: "V#0004", version: 4 });
    expect(content.content_hash).toBe(current.content_hash);
    expect(at).toBe(NOW.toISOString());
  });

  it("builds its own DAO from the environment", async () => {
    vi.stubEnv("RESIDENTS_TABLE_NAME", "");
    await expect(syncResidents([seed])).rejects.toThrow("RESIDENTS_TABLE_NAME");
  });
});
