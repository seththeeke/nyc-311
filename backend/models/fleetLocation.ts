import { z } from "zod";
import { OPERATOR_ACTIVITIES } from "./operator";
import { GpsLocationSchema } from "./gpsLocation";

/*
 * The public, read-only subset of an Order this Operator is currently
 * executing — just enough for the fleet map's on-click detail (§7's
 * on-click enrichment, 2026-09-15): no cost/priority/SLA or other
 * operationally-sensitive fields cross this public boundary.
 */
export const FleetCurrentOrderSchema = z.object({
  order_id: z.string().min(1),
  complaint_type: z.string().min(1).nullable(),
  location_address: z.string().min(1).nullable(),
});
export type FleetCurrentOrder = z.infer<typeof FleetCurrentOrderSchema>;

/*
 * The public, read-only subset of Operator that powers the home-page
 * fleet map (10-capacity-modeling-and-integration.md §6.1) — deliberately
 * narrower than the admin-only Operator projection: no rate_per_hour,
 * removal_requested_at, start/end_datetime, or last_event_sequence. Just
 * enough to plot a dot and label it.
 */
export const FleetOperatorLocationSchema = z.object({
  operator_id: z.string().min(1),
  name: z.string().min(1),
  current_activity: z.enum(OPERATOR_ACTIVITIES),
  current_location: GpsLocationSchema.nullable(),
  /*
   * 11-street-condition-implementation.md §7 — this Operator's last-5-
   * completed-jobs locations, most-recent-first (0-5 entries), for the
   * home-page map's fading path trail. Empty, not null, when an Operator
   * has no resolved jobs yet.
   */
  recent_job_locations: z.array(GpsLocationSchema),
  /*
   * §7's on-click enrichment (2026-09-15) — the Order this Operator is
   * currently executing, or null while idle/between jobs.
   */
  current_order: FleetCurrentOrderSchema.nullable(),
});
export type FleetOperatorLocation = z.infer<typeof FleetOperatorLocationSchema>;

export const FleetLocationsSchema = z.object({
  operators: z.array(FleetOperatorLocationSchema),
});
export type FleetLocations = z.infer<typeof FleetLocationsSchema>;
