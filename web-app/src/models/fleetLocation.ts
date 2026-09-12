import { z } from "zod";

/*
 * Mirrors backend/models/fleetLocation.ts — the public, read-only subset
 * of Operator that powers the home-page fleet map
 * (10-capacity-modeling-and-integration.md §6.1). Deliberately its own
 * model, not a reuse of the admin-only Operator type — no rate_per_hour
 * or other admin-only fields ever cross this boundary.
 */

export const OPERATOR_ACTIVITIES = ["IDLE", "TRANSIT", "WORKING"] as const;
export type OperatorActivity = (typeof OPERATOR_ACTIVITIES)[number];

export const GpsLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type GpsLocation = z.infer<typeof GpsLocationSchema>;

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
