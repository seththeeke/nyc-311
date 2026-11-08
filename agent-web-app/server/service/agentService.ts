import type { Agent } from "../../shared/models/agent.ts";
import { logInfo } from "../logger.ts";
import { NotFoundError } from "../models/errors.ts";
import { readAgentDefinition, readAgentEnvFiles, type AgentEnvFile } from "../source/agentConfigSource.ts";
import { plistPath, readLaunchctlPrint, readLaunchdLog, readPlistJson } from "../source/launchdSource.ts";
import { readRunLock } from "../source/launchdLogRunSource.ts";
import { toAgentConfig } from "./agentConfigService.ts";
import { resolveDeps, type ResolvedDeps, type ServiceDeps } from "./deps.ts";
import { agentHealth } from "./healthService.ts";
import { toLaunchdJob } from "./launchdJobService.ts";
import { nextFire, previousFire } from "./scheduleService.ts";

async function buildAgent(file: AgentEnvFile, deps: ResolvedDeps): Promise<Agent> {
  const { config: server, run, runSource, pidCheck } = deps;
  const now = deps.now();
  const config = toAgentConfig(file.name, file.text, await readAgentDefinition(server.schedulerClone, file.name));
  const plist = plistPath(server.launchAgentsDir, file.name);
  const job = toLaunchdJob(plist, await readPlistJson(server.launchAgentsDir, file.name, run), await readLaunchctlPrint(server.uid, file.name, run));
  const recent = await runSource.listRuns(file.name, 2);
  const currentRun = recent[0]?.status === "RUNNING" ? recent[0] : null;
  const lastRun = recent.find((runSummary) => runSummary.status !== "RUNNING") ?? null;
  const previousFireAt = previousFire(config.schedule, now);
  const health = agentHealth({
    config, job, lastRun, now, previousFireAt,
    newestStartedAt: recent[0]?.startedAt ?? null,
    launchdLog: await readLaunchdLog(server.logRoot, file.name),
    lock: await readRunLock(server.logRoot, file.name, pidCheck),
    schedulerClone: server.schedulerClone,
  });
  logInfo("agent assembled", { agent: file.name, installed: job.installed, loaded: job.loaded, findings: health.map((f) => f.code), running: currentRun !== null });
  return { config, job, health, nextFireAt: job.loaded ? nextFire(config.schedule, now) : null, lastRun, currentRun };
}

/** Every agent with a schedule `.env` in the scheduler clone. */
export async function listAgents(serviceDeps: ServiceDeps): Promise<Agent[]> {
  const deps = resolveDeps(serviceDeps);
  const files = await readAgentEnvFiles(deps.config.schedulerClone);
  logInfo("listing agents", { count: files.length, schedulerClone: deps.config.schedulerClone });
  return Promise.all(files.map((file) => buildAgent(file, deps)));
}

/** One agent; throws NotFoundError when it has no schedule `.env`. */
export async function getAgent(serviceDeps: ServiceDeps, name: string): Promise<Agent> {
  const deps = resolveDeps(serviceDeps);
  const file = (await readAgentEnvFiles(deps.config.schedulerClone)).find((candidate) => candidate.name === name);
  if (!file) {
    logInfo("agent not found", { agent: name });
    throw new NotFoundError(`No agent named ${name}`);
  }
  return buildAgent(file, deps);
}
