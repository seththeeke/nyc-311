import type { FastifyReply, FastifyRequest } from "fastify";
import { agentSchema } from "../../shared/models/agent.ts";
import { getAgent } from "../service/agentService.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { agentParamsSchema } from "./params.ts";
import { parseInput, respond } from "./respond.ts";

/** `GET /api/agents/:agent` */
export function getAgentByName(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) =>
    respond(request, reply, agentSchema, () => getAgent(deps, parseInput(agentParamsSchema, request.params).agent));
}
