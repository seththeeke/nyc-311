import { z } from "zod";

// One row from the NYC 311 SODA API (`erm2-nwe9`), before it becomes a
// Request. Per 1-data-ingestion.md §4, only unique_key (dedup) and
// created_date (ordering/cursor) are required; everything below that is
// optional because record shape varies wildly by complaint_type/agency (a
// noise complaint looks nothing like a pothole report) — a record missing
// any of these still gets stored as a `DRAFT` Request with raw_payload
// intact. Every SODA field returns as a string, even numeric-looking ones
// (e.g. latitude, x_coordinate_state_plane), except the nested `location`
// point.
//
// This slice never resolves Location itself (1-data-ingestion.md §1 —
// out of scope), but raw_payload is what a later LocationResolver reads, so
// the location-shaped fields here (bbl, incident_address, borough,
// community_board, incident_zip, latitude, longitude, plus the
// intersection/address_type fields data-model.md's Location identity
// section discusses) are named to match what data-model.md#location will
// eventually read out of it — not guessed independently.
//
// Field list is the union of every key seen across a real 1,387-record pull
// (`311-test-data/nyc-311-6h-2026-07-29T16-06-30-930Z.json`, see
// data-model.md Appendix A) — not a guaranteed-exhaustive schema from NYC's
// side, hence .passthrough() to carry through any field this list hasn't
// seen yet rather than dropping it.

export const Nyc311RawRecordSchema = z
  .object({
    unique_key: z.string().min(1),
    created_date: z.string().min(1),

    // Complaint core
    complaint_type: z.string().min(1).optional(),
    descriptor: z.string().min(1).optional(),
    descriptor_2: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    due_date: z.string().min(1).optional(),
    closed_date: z.string().min(1).optional(),
    resolution_description: z.string().min(1).optional(),
    resolution_action_updated_date: z.string().min(1).optional(),
    open_data_channel_type: z.string().min(1).optional(),

    // Agency
    agency: z.string().min(1).optional(),
    agency_name: z.string().min(1).optional(),
    facility_type: z.string().min(1).optional(),

    // Location — mirrors data-model.md#location's field set (bbl, address,
    // borough, community_board, zip, latitude, longitude) plus the
    // structural fields (address_type, intersection/cross streets) its
    // "Identity & deduplication" section uses to explain why ~13% of
    // records structurally can't carry a bbl.
    location_type: z.string().min(1).optional(),
    incident_zip: z.string().min(1).optional(),
    incident_address: z.string().min(1).optional(),
    street_name: z.string().min(1).optional(),
    address_type: z.string().min(1).optional(),
    city: z.string().min(1).optional(),
    landmark: z.string().min(1).optional(),
    cross_street_1: z.string().min(1).optional(),
    cross_street_2: z.string().min(1).optional(),
    intersection_street_1: z.string().min(1).optional(),
    intersection_street_2: z.string().min(1).optional(),
    borough: z.string().min(1).optional(),
    community_board: z.string().min(1).optional(),
    council_district: z.string().min(1).optional(),
    police_precinct: z.string().min(1).optional(),
    bbl: z.string().min(1).optional(),
    x_coordinate_state_plane: z.string().min(1).optional(),
    y_coordinate_state_plane: z.string().min(1).optional(),
    latitude: z.string().min(1).optional(),
    longitude: z.string().min(1).optional(),
    // Nested GeoJSON point, redundant with the flat latitude/longitude
    // fields above (which are what a future LocationResolver would read) —
    // kept untyped-but-passed-through rather than schema'd, since nothing
    // in this codebase reads it directly.
    location: z.unknown().optional(),
    park_facility_name: z.string().min(1).optional(),
    park_borough: z.string().min(1).optional(),

    // Complaint-type-specific extras (bridges/highways, taxis, vehicles) —
    // not part of Location, kept only for raw_payload completeness.
    bridge_highway_name: z.string().min(1).optional(),
    bridge_highway_direction: z.string().min(1).optional(),
    bridge_highway_segment: z.string().min(1).optional(),
    road_ramp: z.string().min(1).optional(),
    taxi_company_borough: z.string().min(1).optional(),
    taxi_pick_up_location: z.string().min(1).optional(),
    vehicle_type: z.string().min(1).optional(),
  })
  .passthrough();

export type Nyc311RawRecord = z.infer<typeof Nyc311RawRecordSchema>;
