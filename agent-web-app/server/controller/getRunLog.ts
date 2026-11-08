import type { FastifyReply, FastifyRequest } from "fastify";
import { logChunkSchema } from "../../shared/models/logChunk.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { readRunLog } from "../service/runService.ts";
import { logQuerySchema, runParamsSchema } from "./params.ts";
import { parseInput, respond } from "./respond.ts";

/** `GET /api/agents/:agent/runs/:runId/log?offset=` */
export function getRunLog(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) =>
    respond(request, reply, logChunkSchema, () => {
      const { agent, runId } = parseInput(runParamsSchema, request.params);
      return readRunLog(deps, agent, runId, parseInput(logQuerySchema, request.query).offset);
    });
}
