import type { FastifyReply, FastifyRequest } from "fastify";
import { serverHealthSchema } from "../../shared/models/serverHealth.ts";
import type { ServiceDeps } from "../service/deps.ts";
import { getServerHealth } from "../service/serverHealthService.ts";
import { respond } from "./respond.ts";

/** `GET /api/health` */
export function getHealth(deps: ServiceDeps) {
  return (request: FastifyRequest, reply: FastifyReply) => respond(request, reply, serverHealthSchema, () => getServerHealth(deps));
}
