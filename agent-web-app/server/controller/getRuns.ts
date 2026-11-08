import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { runSummarySchema } from "../../shared/models/run.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { listRuns } from "../service/runService.ts";
import { agentParamsSchema, runsQuerySchema } from "./params.ts";
import { parseInput, respond } from "./respond.ts";

/** `GET /api/agents/:agent/runs?limit=` */
export function getRuns(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) =>
    respond(request, reply, z.array(runSummarySchema), () => {
      const { agent } = parseInput(agentParamsSchema, request.params);
      return listRuns(deps, agent, parseInput(runsQuerySchema, request.query).limit);
    });
}
