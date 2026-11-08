import type { Agent } from "../../../shared/models/agent.ts";
import type { RoomState } from "./pixelKit.ts";

/** How a room shows an agent: at work during a run, alarmed on an error, asleep when not scheduled, otherwise idle. */
export function roomStateOf(agent: Agent): RoomState {
  if (agent.currentRun) return "WORKING";
  if (agent.health.some((finding) => finding.severity === "ERROR")) return "ALERT";
  if (!agent.job.loaded) return "ASLEEP";
  return "IDLE";
}

const DESCRIPTIONS: Record<RoomState, string> = {
  WORKING: "is at work on a run",
  ALERT: "needs attention",
  ASLEEP: "is asleep (not scheduled)",
  IDLE: "is waiting for the next run",
};

export function describeState(state: RoomState): string {
  return DESCRIPTIONS[state];
}
