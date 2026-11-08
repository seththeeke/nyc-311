import { useState } from "react";
import type { Agent } from "../../shared/models/agent.ts";
import { RunDialog } from "./RunDialog.tsx";

/** "Run" for one agent: disabled while it's already running; after a start, says so until the run shows up. */
export function RunButton({ agent, compact = false }: { agent: Agent; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const running = agent.currentRun !== null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={running}
        aria-label={`Run ${agent.config.name} now`}
        title={running ? "Already running" : "Run now, outside the schedule"}
        className={`rounded border border-emerald-600/60 font-medium text-emerald-300 hover:bg-emerald-600/20 disabled:cursor-not-allowed disabled:border-slate-700 disabled:text-slate-500 ${compact ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}
      >
        ▶ Run
      </button>
      {started && !running && <span role="status" className="text-xs text-emerald-300">Started; it appears here in a few seconds.</span>}
      {open && (
        <RunDialog
          agent={agent}
          onClose={(didStart) => {
            setOpen(false);
            if (didStart) setStarted(true);
          }}
        />
      )}
    </>
  );
}
