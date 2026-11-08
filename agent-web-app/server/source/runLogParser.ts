import type { RunSummary } from "../../shared/models/run.ts";
import { runIdToIso, stampToIso } from "./localTime.ts";

export interface RunLogContext {
  agent: string;
  runId: string;
  isRunning: boolean;
  hasReport: boolean;
}

const STAMPED = /^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] (.*)$/;
const DONE = /^=== done \(([^,]*), exit (\d+)\)$/;
const MODE = /→ ([A-Z][A-Z0-9_]*)\b/;
const MODEL = /\(model ([^)]+)\)/;
const PRS_BEFORE = /^open \S+ PRs: \d+ \(([^)]*)\)/;
const PRS_AFTER = /^open \S+ PRs after run: (.*)$/;
const EXITED = /^agent exited (\d+) after (\d+)m(\d+)s/;
const CHAT_ID = /01[0-9A-HJKMNP-TV-Z]{24}/;
const DIE = /^agent-scheduled-run: (.*)$/;

interface Parsed {
  mode: string | null;
  model: string | null;
  exitCode: number | null;
  durationSeconds: number | null;
  endedAt: string | null;
  done: boolean;
  skipped: boolean;
  chatPostId: string | null;
  openPrsBefore: string | null;
  openPrsAfter: string | null;
  warnings: string[];
  error: string | null;
  manual: boolean;
}

function readMessage(message: string, stamp: string | null, parsed: Parsed): void {
  const done = DONE.exec(message);
  if (done) {
    parsed.done = true;
    parsed.mode = done[1] || parsed.mode;
    parsed.exitCode = Number(done[2]);
    parsed.endedAt = stamp;
    return;
  }
  const exited = EXITED.exec(message);
  if (exited) {
    parsed.exitCode = Number(exited[1]);
    parsed.durationSeconds = Number(exited[2]) * 60 + Number(exited[3]);
    return;
  }
  const after = PRS_AFTER.exec(message);
  if (after) {
    parsed.openPrsAfter = after[1];
    return;
  }
  const before = PRS_BEFORE.exec(message);
  if (before) parsed.openPrsBefore = before[1];
  if (message.startsWith("WARN: ")) parsed.warnings.push(message.slice("WARN: ".length));
  else if (message.startsWith("team-chat:")) parsed.chatPostId = CHAT_ID.exec(message)?.[0] ?? parsed.chatPostId;
  else if (message.endsWith("is in progress — skipping")) parsed.skipped = true;
  else if (message.startsWith("nothing assigned to ")) parsed.mode = "IDLE";
  else if (message.startsWith("manual run:")) parsed.manual = true;
  const mode = message.includes(" → ") ? MODE.exec(message) : null;
  if (mode) parsed.mode = mode[1];
  const model = mode ? MODEL.exec(message) : null;
  if (model) parsed.model = model[1];
}

function statusOf(parsed: Parsed, isRunning: boolean): RunSummary["status"] {
  if (parsed.skipped) return "SKIPPED";
  if (parsed.done) {
    if (parsed.exitCode !== 0) return "FAILED";
    return parsed.mode === "IDLE" ? "SKIPPED" : "SUCCEEDED";
  }
  if (parsed.error) return "FAILED";
  return isRunning ? "RUNNING" : "ABORTED";
}

/**
 * Parses one `agent-scheduled-run.sh` log (SPEC.md §2/§3.3). Lenient by
 * design: an unrecognized line is ignored, never an error, since the
 * runner's output drifts as the scripts change.
 */
export function parseRunLog(text: string, context: RunLogContext): RunSummary {
  const parsed: Parsed = {
    mode: null, model: null, exitCode: null, durationSeconds: null, endedAt: null, done: false, skipped: false,
    chatPostId: null, openPrsBefore: null, openPrsAfter: null, warnings: [], error: null, manual: false,
  };
  for (const line of text.split("\n")) {
    const stamped = STAMPED.exec(line);
    if (stamped) {
      readMessage(stamped[2], stampToIso(stamped[1]), parsed);
      continue;
    }
    const die = DIE.exec(line);
    if (die) parsed.error = die[1];
  }
  const startedAt = runIdToIso(context.runId) ?? new Date(0).toISOString();
  const durationSeconds =
    parsed.durationSeconds ?? (parsed.endedAt ? Math.round((Date.parse(parsed.endedAt) - Date.parse(startedAt)) / 1000) : null);
  return {
    agent: context.agent,
    runId: context.runId,
    startedAt,
    endedAt: parsed.endedAt,
    status: statusOf(parsed, context.isRunning),
    mode: parsed.mode,
    model: parsed.model,
    exitCode: parsed.exitCode,
    durationSeconds,
    chatPostId: parsed.chatPostId,
    openPrsBefore: parsed.openPrsBefore,
    openPrsAfter: parsed.openPrsAfter,
    warnings: parsed.warnings,
    error: parsed.error,
    hasReport: context.hasReport,
    manual: parsed.manual,
  };
}
