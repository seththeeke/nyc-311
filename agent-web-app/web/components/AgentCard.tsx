import { Link } from "react-router-dom";
import type { Agent } from "../../shared/models/agent.ts";
import { FindingList } from "./FindingList.tsx";
import { HealthDot } from "./HealthDot.tsx";
import { StatusBadge } from "./StatusBadge.tsx";
import { formatDuration, formatElapsed, formatSlot, formatWhen } from "./format.ts";

/** One agent on the dashboard: state, schedule, next fire, the running or last run, and findings. */
export function AgentCard({ agent }: { agent: Agent }) {
  const { config, currentRun, lastRun } = agent;
  const shown = currentRun ?? lastRun;
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-slate-800 bg-slate-900 p-4">
      <header className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          <Link to={`/agents/${config.name}`} className="hover:underline">{config.name}</Link>
        </h2>
        <HealthDot agent={agent} />
      </header>
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-slate-400">Schedule</dt>
        <dd>{config.schedule.map(formatSlot).join(", ") || "—"}</dd>
        <dt className="text-slate-400">Next</dt>
        <dd>{agent.job.loaded ? formatWhen(agent.nextFireAt) : "not scheduled"}</dd>
        <dt className="text-slate-400">{currentRun ? "Running" : "Last run"}</dt>
        <dd>
          {shown ? (
            <Link to={`/agents/${config.name}/runs/${shown.runId}`} className="inline-flex flex-wrap items-center gap-2 hover:underline">
              <StatusBadge status={shown.status} />
              {currentRun ? `for ${formatElapsed(currentRun.startedAt)}` : `${formatWhen(shown.startedAt)} · ${formatDuration(shown.durationSeconds)}`}
              {shown.mode && <span className="text-slate-400">{shown.mode}</span>}
            </Link>
          ) : (
            "no runs yet"
          )}
        </dd>
      </dl>
      <FindingList findings={agent.health} />
    </article>
  );
}
