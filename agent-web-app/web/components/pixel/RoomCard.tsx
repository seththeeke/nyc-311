import { Link } from "react-router-dom";
import type { Agent } from "../../../shared/models/agent.ts";
import { formatWhen } from "../format.ts";
import { PixelRoom } from "./PixelRoom.tsx";
import { personaFor } from "./personas.ts";
import { describeState, roomStateOf } from "./roomState.ts";

const PLATE: Record<string, string> = {
  WORKING: "text-emerald-300",
  ALERT: "text-rose-300",
  ASLEEP: "text-slate-400",
  IDLE: "text-sky-200",
};

/** One agent's room with a nameplate under it; the whole card links to the agent. */
export function RoomCard({ agent }: { agent: Agent }) {
  const persona = personaFor(agent.config.name);
  const state = roomStateOf(agent);
  const first = persona.name.split(" ")[0];
  return (
    <Link
      to={`/agents/${agent.config.name}`}
      className="group block overflow-hidden rounded-sm border-4 border-slate-700 bg-slate-950 shadow-[4px_4px_0_0_#0b0f1a] transition-transform hover:-translate-y-0.5 hover:border-slate-500 focus-visible:border-amber-400"
    >
      <PixelRoom draw={persona.draw} state={state} label={`${persona.room}: ${first} ${describeState(state)}`} />
      <div className="space-y-1 border-t-4 border-slate-700 bg-slate-900 px-3 py-2 font-pixel text-[10px] leading-4">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-amber-200">{persona.name}</span>
          <span className={PLATE[state]}>{state}</span>
        </div>
        <div className="flex items-baseline justify-between gap-2 text-slate-400">
          <span>{persona.title} · {persona.room}</span>
          <span>{agent.currentRun ? "on shift" : agent.job.loaded ? `next ${formatWhen(agent.nextFireAt)}` : "off duty"}</span>
        </div>
      </div>
    </Link>
  );
}
