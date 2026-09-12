import { z } from "zod";

/*
 * Shared across dao/operator, service/scheduling, and the order-execution
 * Lambda (10-capacity-modeling-and-integration.md §3.7) — a GPS ping's
 * position. Not a domain entity of its own; pings piggyback on the
 * existing OperatorEvent payloads rather than getting a dedicated table.
 */
export const GpsLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
});
export type GpsLocation = z.infer<typeof GpsLocationSchema>;

/**
 * Fixed mock depot position every Operator starts at and returns to
 * conceptually between jobs (§3.7) — a real depot/address entity is
 * future work, same "stub proves the shape" precedent as
 * `MOCK_TRANSIT_MINUTES` et al. Also the fallback position when a job's
 * Location record is missing or has null lat/lng (real 311 geodata is
 * sometimes incomplete).
 */
export const HOME_DEPOT_LOCATION: GpsLocation = { lat: 40.7128, lng: -74.006 };
