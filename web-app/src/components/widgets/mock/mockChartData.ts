/*
 * WIP (work in progress): hard-coded sample shares for the two mock chart
 * tiles (12-UX-workspace-refactor.md §6). No service calls — replace with real
 * hooks when the metrics are built. Values are counts/percent points; the
 * charts normalize them, so they needn't sum to 100.
 */
export interface MockShare {
  label: string;
  value: number;
}

/* Where each Order sits right now. */
export const MOCK_ORDERS_BY_STATUS: readonly MockShare[] = [
  { label: "Completed", value: 62 },
  { label: "Scheduled", value: 21 },
  { label: "In progress", value: 12 },
  { label: "Rejected", value: 5 },
];

/* Share of fleet time by activity (mirrors the map legend's Working / In transit / Idle). */
export const MOCK_FLEET_UTILIZATION: readonly MockShare[] = [
  { label: "Working", value: 58 },
  { label: "In transit", value: 27 },
  { label: "Idle", value: 15 },
];
