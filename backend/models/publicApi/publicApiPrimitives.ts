import { z } from "zod";

/* Field formats shared by every /v1/ route (16-resident-action-models.md §2.2). */

/* The calling client, e.g. `resident:hawthorn`. Format-checked only, never authenticated. */
export const RequesterSchema = z.string().regex(/^[a-z0-9][a-z0-9:._-]{0,63}$/);

/* Optional on creating POSTs; stored as the domain's client_request_id. */
export const IdempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,128}$/);

/* Crockford base32, 26 characters: every public id is a ULID. */
export const UlidSchema = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/, "must be a ULID");

/* A ULID-timestamped ISO 8601 instant, as stored. */
export const TimestampSchema = z.string().min(1);
