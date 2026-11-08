import { agentListSchema, agentSchema, type Agent } from "../../shared/models/agent.ts";
import { getJson } from "./apiClient.ts";

export function listAgents(): Promise<Agent[]> {
  return getJson("/agents", agentListSchema);
}

export function getAgent(name: string): Promise<Agent> {
  return getJson(`/agents/${encodeURIComponent(name)}`, agentSchema);
}
