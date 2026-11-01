import type { OperatorActor } from "./operator";

/*
 * Who is changing the fleet and why (docs/17-executive-team.md §12.3),
 * stamped on the operator event's actor and payload.
 */
export interface CapacityChange {
  actor: OperatorActor;
  /* Required from an agent; optional from the admin. */
  reason: string | null;
  /* The caller's email, or null for a system change. */
  by: string | null;
}

export const ADMIN_CAPACITY_CHANGE: CapacityChange = { actor: "ADMIN", reason: null, by: null };
