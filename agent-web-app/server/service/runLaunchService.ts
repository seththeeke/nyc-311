import type { RunRequest, RunStarted } from "../../shared/models/runRequest.ts";
import { logInfo } from "../logger.ts";
import { ConflictError, ValidationError } from "../models/errors.ts";
import { launchRun, type LaunchEnv, type RunLauncher } from "../source/runLauncher.ts";
import { getAgent } from "./agentService.ts";
import type { ServiceDeps } from "./deps.ts";

export interface LaunchDeps extends ServiceDeps {
  launcher?: RunLauncher;
}

/**
 * Starts the agent now, outside its schedule (SPEC.md §5.1). Refuses an
 * agent already running (the wrapper's lock would skip it anyway) and a
 * slot mode the agent's schedule doesn't have.
 */
export async function startRun(deps: LaunchDeps, name: string, request: RunRequest): Promise<RunStarted> {
  const agent = await getAgent(deps, name);
  if (agent.currentRun) throw new ConflictError(`${name} is already running (run ${agent.currentRun.runId})`);
  const modes = new Set(agent.config.schedule.map((slot) => slot.mode).filter((mode) => mode !== null));
  if (request.mode !== null && !modes.has(request.mode)) throw new ValidationError(`${name} has no ${request.mode} mode`);
  const prompt = request.prompt.trim();
  const env: LaunchEnv = { AGENT_MANUAL: "1", AGENT_LOG_ROOT: deps.config.logRoot };
  if (prompt !== "") {
    env.AGENT_PROMPT = prompt;
    env.AGENT_PROMPT_MODE = request.promptMode === "REPLACE" ? "replace" : "append";
  }
  if (request.mode !== null) env.AGENT_MODE = request.mode;
  if (request.testChat) env.AGENT_CHAT_ENV = "TEST";
  const pid = (deps.launcher ?? launchRun)(deps.config.schedulerClone, name, env);
  logInfo("manual run started", { agent: name, pid, promptMode: env.AGENT_PROMPT_MODE ?? "scheduled", promptLength: prompt.length, mode: request.mode, testChat: request.testChat });
  return { agent: name, pid, requestedAt: new Date().toISOString() };
}
