import type { FastifyReply, FastifyRequest } from "fastify";
import { agentListSchema } from "../../shared/models/agent.ts";
import { listAgents } from "../service/agentService.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { respond } from "./respond.ts";

/** `GET /api/agents` */
export function getAgents(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) => respond(request, reply, agentListSchema, () => listAgents(deps));
}
