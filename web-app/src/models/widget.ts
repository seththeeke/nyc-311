import { z } from "zod";

/*
 * Serializable pieces of the widget contract (12-UX-workspace-refactor.md
 * §4.3). The registry that binds each id to a React component lives in
 * components/widgets/, since component references aren't serializable.
 */

export const WIDGET_IDS = [
  "FLEET_MAP",
  "CAPACITY",
  "TOTAL_REQUESTS",
  "SERVICED",
  "TOTAL_COST_EST",
  "MEAN_TIME_TO_RESOLVE",
  "MEDIAN_TIME_TO_RESOLVE",
] as const;
export type WidgetId = (typeof WIDGET_IDS)[number];
export const WidgetIdSchema = z.enum(WIDGET_IDS);

/* TILE = compact card (secondary workspace); FULL = fills the primary workspace; PANEL = in between, reserved for combined views. */
export const WIDGET_SIZES = ["TILE", "PANEL", "FULL"] as const;
export type WidgetSize = (typeof WIDGET_SIZES)[number];
export const WidgetSizeSchema = z.enum(WIDGET_SIZES);

export const WIDGET_STATUSES = ["LIVE", "WORK_IN_PROGRESS"] as const;
export type WidgetStatus = (typeof WIDGET_STATUSES)[number];
export const WidgetStatusSchema = z.enum(WIDGET_STATUSES);
