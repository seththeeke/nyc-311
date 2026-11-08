import type { Agent } from "../../../shared/models/agent.ts";
import { useAgents } from "../../hooks/queries.ts";
import { AgentCard } from "../AgentCard.tsx";
import { QueryState } from "../QueryState.tsx";

/** Sorts attention-worthy agents first: running, then errors, then warnings, then the rest by name. */
function rank(agent: Agent): number {
  if (agent.currentRun) return 0;
  if (agent.health.some((f) => f.severity === "ERROR")) return 1;
  if (agent.health.length > 0) return 2;
  return 3;
}

export function DashboardPage() {
  const { data, error } = useAgents();
  return (
    <QueryState data={data} error={error}>
      {(agents) => {
        const running = agents.filter((agent) => agent.currentRun).length;
        const sorted = [...agents].sort((a, b) => rank(a) - rank(b) || a.config.name.localeCompare(b.config.name));
        return (
          <section aria-labelledby="agents-heading" className="space-y-4">
            <h2 id="agents-heading" className="text-sm text-slate-400">
              {agents.length} agents · {running} running now
            </h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {sorted.map((agent) => <AgentCard key={agent.config.name} agent={agent} />)}
            </div>
          </section>
        );
      }}
    </QueryState>
  );
}
