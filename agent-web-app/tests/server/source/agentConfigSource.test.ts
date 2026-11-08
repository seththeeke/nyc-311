import { describe, expect, it } from "vitest";
import path from "node:path";
import { readAgentDefinition, readAgentEnvFiles } from "../../../server/source/agentConfigSource.ts";
import { MACHINE } from "../fixtures.ts";

const clone = path.join(MACHINE, "clone");

describe("agentConfigSource", () => {
  it("reads every agent .env, sorted, skipping team-chat.env", async () => {
    const files = await readAgentEnvFiles(clone);
    expect(files.map((file) => file.name)).toEqual(["alpha-agent", "beta-agent", "delta-agent", "gamma-agent"]);
    expect(files[0].text).toContain("SCHEDULE=");
  });

  it("reads an agent definition, or null", async () => {
    expect(await readAgentDefinition(clone, "alpha-agent")).toContain("name: alpha-agent");
    expect(await readAgentDefinition(clone, "gamma-agent")).toBeNull();
  });

  it("returns nothing for a clone without schedules", async () => {
    expect(await readAgentEnvFiles(path.join(MACHINE, "nowhere"))).toEqual([]);
  });
});
