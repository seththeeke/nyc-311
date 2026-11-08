import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ServerConfig } from "../../server/config.ts";
import type { CommandResult, CommandRunner } from "../../server/source/commandRunner.ts";

export const TEST_DATA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../test-data");
export const MACHINE = path.join(TEST_DATA, "machine");

export function fixtureText(name: string): string {
  return readFileSync(path.join(TEST_DATA, name), "utf8");
}

/** A config pointing every path at `test-data/machine`. */
export function fixtureConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
  return {
    host: "127.0.0.1",
    port: 0,
    logRoot: path.join(MACHINE, "logs"),
    schedulerClone: path.join(MACHINE, "clone"),
    primaryCheckout: path.join(MACHINE, "clone"),
    launchAgentsDir: path.join(MACHINE, "LaunchAgents"),
    uid: 501,
    staticDir: null,
    ...overrides,
  };
}

/** A CommandRunner that answers by the first matching `command arg…` prefix, else exit 1. Records every call. */
export function stubRunner(answers: Record<string, CommandResult>): CommandRunner & { calls: string[] } {
  const calls: string[] = [];
  const runner = async (command: string, args: string[]) => {
    const line = [command, ...args].join(" ");
    calls.push(line);
    const key = Object.keys(answers).find((prefix) => line.startsWith(prefix));
    return key ? answers[key] : { stdout: "", code: 1 };
  };
  return Object.assign(runner, { calls });
}

/** The plist JSON `plutil` would print for alpha-agent. */
export const ALPHA_PLIST_JSON = JSON.stringify({
  ProgramArguments: ["/bin/sh", `${path.join(MACHINE, "clone")}/scripts/agent-scheduled-run.sh`, "alpha-agent"],
  StartCalendarInterval: [{ Hour: 5, Minute: 0 }, { Hour: 14, Minute: 0 }, { Weekday: 1, Hour: 21, Minute: 30 }],
});

/** beta-agent's plist points at ~/Documents (the 2026-11-05 incident) and an old schedule. */
export const BETA_PLIST_JSON = JSON.stringify({
  ProgramArguments: ["/bin/sh", "/Users/x/Documents/nyc-311/scripts/agent-scheduled-run.sh", "beta-agent"],
  StartCalendarInterval: { Hour: 6, Minute: 0 },
});

/** Local-time ISO for a wall-clock time, so tests pass in any time zone. */
export function local(y: number, mo: number, d: number, h: number, mi: number, s = 0): string {
  return new Date(y, mo - 1, d, h, mi, s).toISOString();
}
