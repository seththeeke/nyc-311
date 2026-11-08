import path from "node:path";
import { listDir, readTextOrNull } from "./fileSource.ts";

export interface AgentEnvFile {
  name: string;
  text: string;
}

/** `team-chat.env` holds the shared sign-in config, not an agent. */
const NOT_AGENTS = new Set(["team-chat"]);

/** Every agent's `.env` under `<clone>/scripts/agent-schedules/`, sorted by name. */
export async function readAgentEnvFiles(schedulerClone: string): Promise<AgentEnvFile[]> {
  const dir = path.join(schedulerClone, "scripts/agent-schedules");
  const names = (await listDir(dir))
    .filter((file) => file.endsWith(".env"))
    .map((file) => file.slice(0, -".env".length))
    .filter((name) => !NOT_AGENTS.has(name))
    .sort();
  const read = await Promise.all(names.map(async (name) => ({ name, text: await readTextOrNull(path.join(dir, `${name}.env`)) })));
  return read.filter((file): file is AgentEnvFile => file.text !== null);
}

/** The agent's definition, `<clone>/.claude/agents/<agent>.md`, or null. */
export async function readAgentDefinition(schedulerClone: string, agent: string): Promise<string | null> {
  return readTextOrNull(path.join(schedulerClone, ".claude/agents", `${agent}.md`));
}
