import { agentKindSchema, type AgentConfig, type AgentKind } from "../../shared/models/agentConfig.ts";
import type { ScheduleSlot } from "../../shared/models/scheduleSlot.ts";

const ASSIGNMENT = /^([A-Z_][A-Z0-9_]*)=(.*)$/;
const SLOT = /^(?:(Sun|Mon|Tue|Wed|Thu|Fri|Sat)@)?(\d{1,2}):(\d{2})(?:=([A-Z][A-Z0-9_]*))?$/;
const FLAG_KEYS = ["OPS_TOOLS", "PRODUCT_TOOLS", "ENGINEERING_TOOLS", "MEMORY", "REPORTS", "USAGE_SUMMARY"];

/**
 * Reads `KEY=value` lines from a schedule `.env` without sourcing it (its
 * prompts contain `$(date …)`). A quoted value runs to the line's last quote;
 * multi-line values only matter for prompts, which aren't read here.
 */
export function parseEnv(text: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const match = ASSIGNMENT.exec(line.trim());
    if (!match) continue;
    let value = match[2].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.lastIndexOf(quote) > 0) value = value.slice(1, value.lastIndexOf(quote));
    values[match[1]] = value;
  }
  return values;
}

/** `SCHEDULE`'s `[Day@]HH:MM[=MODE]` slots; malformed slots are dropped (the installer rejects them anyway). */
export function parseSchedule(schedule: string | undefined): ScheduleSlot[] {
  return (schedule ?? "")
    .split(/\s+/)
    .map((slot) => SLOT.exec(slot))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ day: match[1] ?? null, time: `${match[2].padStart(2, "0")}:${match[3]}`, mode: match[4] ?? null }));
}

/** The `description:` from an agent definition's frontmatter, single-line or folded (`>`). */
export function parseDescription(markdown: string | null): string | null {
  const frontmatter = /^---\n([\s\S]*?)\n---/.exec(markdown ?? "")?.[1];
  if (!frontmatter) return null;
  const lines = frontmatter.split("\n");
  const start = lines.findIndex((line) => line.startsWith("description:"));
  if (start < 0) return null;
  const inline = lines[start].slice("description:".length).trim();
  if (inline !== "" && inline !== ">" && inline !== "|") return inline.replace(/^["']|["']$/g, "");
  const folded: string[] = [];
  for (const line of lines.slice(start + 1)) {
    if (!/^\s+\S/.test(line)) break;
    folded.push(line.trim());
  }
  return folded.length > 0 ? folded.join(" ") : null;
}

function kindOf(raw: string | undefined): AgentKind {
  const parsed = agentKindSchema.safeParse((raw ?? "pr-limit").toUpperCase().replace(/-/g, "_"));
  return parsed.success ? parsed.data : "PR_LIMIT";
}

/** An agent's config from its `.env` text and its definition's markdown. */
export function toAgentConfig(name: string, envText: string, definition: string | null): AgentConfig {
  const env = parseEnv(envText);
  const maxOpenPrs = env.MAX_OPEN_PRS !== undefined ? Number(env.MAX_OPEN_PRS) : NaN;
  return {
    name,
    description: parseDescription(definition),
    kind: kindOf(env.KIND),
    schedule: parseSchedule(env.SCHEDULE),
    model: env.MODEL ?? null,
    teamChatEnv: env.TEAM_CHAT_ENV ?? null,
    branchPrefix: env.BRANCH_PREFIX ?? null,
    maxOpenPrs: Number.isFinite(maxOpenPrs) ? maxOpenPrs : null,
    flags: FLAG_KEYS.filter((key) => env[key] === "1"),
  };
}
