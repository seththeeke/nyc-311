import type { Agent } from "../../shared/models/agent.ts";

/** One-glance agent state: running, error, warning, paused or healthy. */
export function agentState(agent: Agent): { label: string; className: string } {
  if (agent.currentRun) return { label: "Running", className: "bg-sky-400" };
  if (agent.health.some((f) => f.severity === "ERROR")) return { label: "Error", className: "bg-rose-500" };
  if (!agent.job.loaded) return { label: agent.job.installed ? "Paused" : "Not installed", className: "bg-slate-500" };
  if (agent.health.length > 0) return { label: "Warning", className: "bg-amber-400" };
  return { label: "Healthy", className: "bg-emerald-500" };
}

export function HealthDot({ agent }: { agent: Agent }) {
  const state = agentState(agent);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-300">
      <span aria-hidden="true" className={`h-2 w-2 rounded-full ${state.className}`} />
      {state.label}
    </span>
  );
}
