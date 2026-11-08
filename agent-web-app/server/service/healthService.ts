import type { AgentConfig } from "../../shared/models/agentConfig.ts";
import type { HealthFinding } from "../../shared/models/healthFinding.ts";
import type { LaunchdJob } from "../../shared/models/launchdJob.ts";
import type { RunSummary } from "../../shared/models/run.ts";
import { slotKey } from "./scheduleService.ts";

export interface AgentHealthInput {
  config: AgentConfig;
  job: LaunchdJob;
  lastRun: RunSummary | null;
  /** When the newest run started, including one still running; null when there are none. */
  newestStartedAt: string | null;
  launchdLog: { text: string; modifiedAt: Date } | null;
  lock: { pid: number; alive: boolean } | null;
  schedulerClone: string;
  previousFireAt: string | null;
  now: Date;
}

/** A run that should have started by now gets this much slack before it counts as missed. */
const MISSED_GRACE_MS = 10 * 60 * 1000;

function sameSlots(a: string[], b: string[]): boolean {
  return [...a].sort().join(" ") === [...b].sort().join(" ");
}

function setupFindings(input: AgentHealthInput): HealthFinding[] {
  const { job, config, schedulerClone } = input;
  if (!job.installed) return [{ severity: "WARN", code: "NOT_INSTALLED", message: "No launchd job is installed for this agent." }];
  const findings: HealthFinding[] = [];
  if (!job.loaded) findings.push({ severity: "WARN", code: "NOT_LOADED", message: "Installed but not loaded in launchd (paused)." });
  if (job.scriptPath && !job.scriptPath.startsWith(`${schedulerClone}/`)) {
    const tcc = job.scriptPath.includes("/Documents/") ? " launchd can't read ~/Documents, so every run fails." : "";
    findings.push({ severity: "ERROR", code: "WRONG_CHECKOUT", message: `The plist runs ${job.scriptPath}, not the scheduler clone.${tcc} Reinstall from ${schedulerClone}.` });
  }
  const wanted = config.schedule.map(slotKey);
  if (!sameSlots(job.plistSlots, wanted)) {
    findings.push({ severity: "WARN", code: "SCHEDULE_DRIFT", message: `Installed times (${job.plistSlots.join(" ") || "none"}) differ from SCHEDULE (${wanted.join(" ") || "none"}). Reinstall to apply.` });
  }
  return findings;
}

function runFindings(input: AgentHealthInput): HealthFinding[] {
  const { lastRun, launchdLog, lock, job, previousFireAt, now } = input;
  const findings: HealthFinding[] = [];
  const lastStart = input.newestStartedAt ? Date.parse(input.newestStartedAt) : 0;
  if (launchdLog && launchdLog.text.trim() !== "" && launchdLog.modifiedAt.getTime() > lastStart) {
    const lastLine = launchdLog.text.trim().split("\n").pop();
    findings.push({ severity: "ERROR", code: "LAUNCHD_ERROR", message: `launchd couldn't start the job: ${lastLine}` });
  }
  if (lastRun?.status === "FAILED") findings.push({ severity: "ERROR", code: "LAST_RUN_FAILED", message: `The last run (${lastRun.runId}) failed${lastRun.error ? `: ${lastRun.error}` : ` with exit ${lastRun.exitCode}`}.` });
  if (lastRun?.status === "ABORTED") findings.push({ severity: "WARN", code: "LAST_RUN_ABORTED", message: `The last run (${lastRun.runId}) stopped without finishing.` });
  if (lastRun && lastRun.warnings.length > 0) findings.push({ severity: "WARN", code: "RUN_WARNINGS", message: `The last run logged ${lastRun.warnings.length} warning(s), first: ${lastRun.warnings[0]}` });
  const due = previousFireAt ? Date.parse(previousFireAt) : null;
  if (job.loaded && input.newestStartedAt && due !== null && now.getTime() - due > MISSED_GRACE_MS && lastStart < due - 60 * 1000) {
    findings.push({ severity: "WARN", code: "MISSED_RUN", message: `No run started for the ${new Date(due).toLocaleString()} slot.` });
  }
  if (lock && !lock.alive) findings.push({ severity: "WARN", code: "STALE_LOCK", message: `The run lock is held by pid ${lock.pid}, which isn't running. The next run reclaims it.` });
  return findings;
}

/** Every problem with one agent's setup and recent runs (SPEC.md §3.2), errors first. */
export function agentHealth(input: AgentHealthInput): HealthFinding[] {
  const findings = [...setupFindings(input), ...runFindings(input)];
  return findings.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "ERROR" ? -1 : 1));
}

/** Machine-wide problems: the scheduler clone must be a clean `main` or the runner stops updating it. */
export function cloneHealth(schedulerClone: string, branch: string | null, dirtyCount: number): HealthFinding[] {
  const findings: HealthFinding[] = [];
  if (branch !== "main") findings.push({ severity: "WARN", code: "CLONE_NOT_MAIN", message: `The scheduler clone ${schedulerClone} is on ${branch ?? "a detached HEAD"}, not main; runs won't update it.` });
  if (dirtyCount > 0) findings.push({ severity: "WARN", code: "CLONE_DIRTY", message: `The scheduler clone has ${dirtyCount} changed file(s); runs won't update it.` });
  return findings;
}
