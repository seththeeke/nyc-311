import { spawn } from "node:child_process";
import path from "node:path";

/** What a manual run passes to `agent-scheduled-run.sh` (its header documents each variable). */
export interface LaunchEnv {
  AGENT_MANUAL: "1";
  AGENT_LOG_ROOT: string;
  AGENT_PROMPT?: string;
  AGENT_PROMPT_MODE?: "append" | "replace";
  AGENT_MODE?: string;
  AGENT_CHAT_ENV?: string;
}

/** Starts a run and returns its pid; stubbed in tests so no agent ever starts. */
export type RunLauncher = (schedulerClone: string, agent: string, env: LaunchEnv) => number;

/**
 * Starts the scheduler's own wrapper for the agent, detached, so the run gets
 * everything a scheduled one does (latest code, lock, worktree, chat,
 * reports, log) and outlives a restart of this server.
 */
export const launchRun: RunLauncher = (schedulerClone, agent, env) => {
  const child = spawn("/bin/sh", [path.join(schedulerClone, "scripts/agent-scheduled-run.sh"), agent], {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...env },
  });
  child.unref();
  if (child.pid === undefined) throw new Error(`Couldn't start the run for ${agent}`);
  return child.pid;
};
