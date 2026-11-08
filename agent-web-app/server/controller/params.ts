import { z } from "zod";

export const agentParamsSchema = z.object({ agent: z.string().regex(/^[a-z][a-z0-9-]*$/) });
export const runParamsSchema = agentParamsSchema.extend({ runId: z.string().regex(/^\d{8}T\d{6}$/) });
export const runsQuerySchema = z.object({ limit: z.coerce.number().int().min(1).max(500).default(50) });
export const logQuerySchema = z.object({ offset: z.coerce.number().int().min(0).default(0) });
