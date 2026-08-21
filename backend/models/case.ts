import { z } from "zod";

/*
 * Seed of the real Case model (data-model.md#case), which doesn't exist
 * yet — no Cases table, no CaseDao. This is only the input shape
 * `service/case/caseService.ts`'s stub needs today; the full Case/CaseEvent
 * schemas get built alongside real Case persistence later.
 */

export const CASE_TYPES = [
  "WORKFLOW_EXECUTION_FAILURE",
  "LOCATION_RESOLUTION_FAILURE",
  "CAPACITY_SLA_BREACH",
] as const;

export type CaseType = (typeof CASE_TYPES)[number];

export const CreateCaseInputSchema = z.object({
  case_type: z.enum(CASE_TYPES),
  request_id: z.string().min(1).nullable(),
  order_id: z.string().min(1).nullable(),
  reason: z.string().min(1),
});

export type CreateCaseInput = z.infer<typeof CreateCaseInputSchema>;
