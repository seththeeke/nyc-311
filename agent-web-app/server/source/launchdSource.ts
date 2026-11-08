import path from "node:path";
import type { CommandRunner } from "./commandRunner.ts";
import { mtimeOrNull, readTextOrNull } from "./fileSource.ts";

export function plistPath(launchAgentsDir: string, agent: string): string {
  return path.join(launchAgentsDir, `com.nyc311.agent.${agent}.plist`);
}

/** The agent's plist as JSON (via `plutil`), or null when it isn't installed or can't be read. */
export async function readPlistJson(launchAgentsDir: string, agent: string, run: CommandRunner): Promise<unknown> {
  const file = plistPath(launchAgentsDir, agent);
  if ((await mtimeOrNull(file)) === null) return null;
  const result = await run("plutil", ["-convert", "json", "-o", "-", file]);
  if (result.code !== 0) return null;
  try {
    return JSON.parse(result.stdout) as unknown;
  } catch {
    return null;
  }
}

/** `launchctl print` for the agent's job, or null when launchd doesn't have it loaded. */
export async function readLaunchctlPrint(uid: number, agent: string, run: CommandRunner): Promise<string | null> {
  const result = await run("launchctl", ["print", `gui/${uid}/com.nyc311.agent.${agent}`]);
  return result.code === 0 ? result.stdout : null;
}

export interface LaunchdLog {
  text: string;
  modifiedAt: Date;
}

/** The agent's `launchd.log`: launchd's own stdout/stderr, empty when the job starts fine. */
export async function readLaunchdLog(logRoot: string, agent: string): Promise<LaunchdLog | null> {
  const file = path.join(logRoot, agent, "launchd.log");
  const modifiedAt = await mtimeOrNull(file);
  const text = await readTextOrNull(file);
  return modifiedAt && text !== null ? { text, modifiedAt } : null;
}
