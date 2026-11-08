import type { Agent } from "../../../shared/models/agent.ts";
import { useAgents } from "../../hooks/queries.ts";
import { QueryState } from "../QueryState.tsx";
import { RoomCard } from "../pixel/RoomCard.tsx";
import { ROSTER_ORDER } from "../pixel/personas.ts";

function rosterRank(agent: Agent): number {
  const index = ROSTER_ORDER.indexOf(agent.config.name);
  return index < 0 ? ROSTER_ORDER.length : index;
}

/** The Pixel Office: every agent in an 8-bit room of their own, showing what they're doing right now. */
export function PixelOfficePage() {
  const { data, error } = useAgents();
  return (
    <section aria-labelledby="office-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="office-heading" className="font-pixel text-sm text-amber-200">BoroughSim HQ · The Pixel Office</h2>
        <p className="font-pixel text-[10px] text-slate-400">Rooms follow live runs and your clock</p>
      </div>
      <QueryState data={data} error={error}>
        {(agents) => (
          <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-3">
            {[...agents].sort((a, b) => rosterRank(a) - rosterRank(b) || a.config.name.localeCompare(b.config.name)).map((agent) => (
              <RoomCard key={agent.config.name} agent={agent} />
            ))}
          </div>
        )}
      </QueryState>
    </section>
  );
}
