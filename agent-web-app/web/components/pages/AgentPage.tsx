import { useParams } from "react-router-dom";
import { useAgent, useRuns } from "../../hooks/queries.ts";
import { FindingList } from "../FindingList.tsx";
import { HealthDot } from "../HealthDot.tsx";
import { QueryState } from "../QueryState.tsx";
import { RunButton } from "../RunButton.tsx";
import { RunTable } from "../RunTable.tsx";
import { formatSlot, formatWhen } from "../format.ts";

const RUN_LIMIT = 100;

/** One agent: config, launchd job, findings and run history. */
export function AgentPage() {
  /* The route (agents/:agent) always supplies it. */
  const { agent: name } = useParams() as { agent: string };
  const agent = useAgent(name);
  const runs = useRuns(name, RUN_LIMIT);
  return (
    <div className="space-y-6">
      <QueryState data={agent.data} error={agent.error}>
        {(loaded) => {
          const { config, job, health, nextFireAt } = loaded;
          return (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold">{config.name}</h2>
              <HealthDot agent={loaded} />
              <RunButton agent={loaded} />
            </div>
            {config.description && <p className="max-w-3xl text-sm text-slate-300">{config.description}</p>}
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-400">Kind</dt><dd>{config.kind}</dd>
              <dt className="text-slate-400">Schedule</dt><dd>{config.schedule.map(formatSlot).join(", ") || "—"}</dd>
              <dt className="text-slate-400">Next fire</dt><dd>{job.loaded ? formatWhen(nextFireAt) : "not scheduled"}</dd>
              <dt className="text-slate-400">Model</dt><dd>{config.model ?? "agent default"}</dd>
              <dt className="text-slate-400">Team Chat</dt><dd>{config.teamChatEnv ?? "off"}</dd>
              <dt className="text-slate-400">Flags</dt><dd>{config.flags.join(", ") || "—"}</dd>
              <dt className="text-slate-400">launchd</dt>
              <dd>{job.installed ? `${job.loaded ? `loaded, ${job.state ?? "?"}` : "installed, not loaded"} · last exit ${job.lastExitCode ?? "—"}` : "not installed"}</dd>
              <dt className="text-slate-400">Script</dt><dd className="font-mono text-xs leading-5 break-all">{job.scriptPath ?? "—"}</dd>
            </dl>
            <FindingList findings={health} />
          </section>
          );
        }}
      </QueryState>
      <section aria-labelledby="runs-heading" className="space-y-2">
        <h3 id="runs-heading" className="font-semibold">Runs</h3>
        <QueryState data={runs.data} error={runs.error}>
          {(list) => <RunTable runs={list} />}
        </QueryState>
      </section>
    </div>
  );
}
