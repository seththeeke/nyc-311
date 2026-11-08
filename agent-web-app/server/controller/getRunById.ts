import type { FastifyReply, FastifyRequest } from "fastify";
import { runDetailSchema } from "../../shared/models/runDetail.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { getRun } from "../service/runService.ts";
import { runParamsSchema } from "./params.ts";
import { parseInput, respond } from "./respond.ts";

/** `GET /api/agents/:agent/runs/:runId` */
export function getRunById(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) =>
    respond(request, reply, runDetailSchema, () => {
      const { agent, runId } = parseInput(runParamsSchema, request.params);
      return getRun(deps, agent, runId);
    });
}
