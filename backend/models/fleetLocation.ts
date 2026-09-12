import { z } from "zod";
import { OPERATOR_ACTIVITIES } from "./operator";
import { GpsLocationSchema } from "./gpsLocation";

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
});
export type FleetOperatorLocation = z.infer<typeof FleetOperatorLocationSchema>;

export const FleetLocationsSchema = z.object({
  operators: z.array(FleetOperatorLocationSchema),
});
export type FleetLocations = z.infer<typeof FleetLocationsSchema>;
