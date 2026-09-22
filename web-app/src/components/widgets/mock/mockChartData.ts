import type { ShareInput } from "../chartShares";

/*
 * WIP (work in progress): hard-coded sample shares for the Orders by Status
 * mock chart tile (12-UX-workspace-refactor.md §6). No service calls — replace
 * with a real hook when the metric is built. Values are counts/percent
 * points; the chart normalizes them, so they needn't sum to 100.
 */
export type MockShare = ShareInput;

/* Where each Order sits right now. */
export const MOCK_ORDERS_BY_STATUS: readonly MockShare[] = [
  { label: "Completed", value: 62 },
  { label: "Scheduled", value: 21 },
  { label: "In progress", value: 12 },
  { label: "Rejected", value: 5 },
];
