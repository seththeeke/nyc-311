import { z } from "zod";

/*
 * Deliberately not data-model.md's full Operator projection
 * (function_type/status/current_shift_id/current_activity) — there's no
 * real Operators table yet (6-order-scheduling.md §6). This is only the
 * shape OperatorDao's stateless stub needs today: something to put in
 * Order.assigned_operator_id.
 */

export const OperatorSchema = z.object({
  operator_id: z.string().min(1),
});

export type Operator = z.infer<typeof OperatorSchema>;
