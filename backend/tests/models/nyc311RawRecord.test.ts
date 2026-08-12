import { describe, expect, it } from "vitest";
import { Nyc311RawRecordSchema } from "../../models/nyc311RawRecord";
import normalWithBbl from "../service/ingestion/nyc311-normal-with-bbl.json";
import structurallyNoBbl from "../service/ingestion/nyc311-structurally-no-bbl-intersection.json";
import missingOptionalFields from "../service/ingestion/nyc311-missing-optional-fields.json";
import unfamiliarAgency from "../service/ingestion/nyc311-unfamiliar-agency.json";
import missingUniqueKey from "../service/ingestion/nyc311-missing-unique-key.json";
import missingCreatedDate from "../service/ingestion/nyc311-missing-created-date.json";
import emptyRequiredFields from "../service/ingestion/nyc311-empty-required-fields.json";

describe("Nyc311RawRecordSchema", () => {
  it("accepts a fully-populated record with a bbl", () => {
    expect(Nyc311RawRecordSchema.safeParse(normalWithBbl).success).toBe(true);
  });

  it("accepts a structurally-no-bbl intersection record", () => {
    expect(Nyc311RawRecordSchema.safeParse(structurallyNoBbl).success).toBe(true);
  });

  it("accepts a record with only the two required fields (lenient ingest)", () => {
    expect(Nyc311RawRecordSchema.safeParse(missingOptionalFields).success).toBe(true);
  });

  it("accepts an unfamiliar agency value — no enum on agency", () => {
    const parsed = Nyc311RawRecordSchema.safeParse(unfamiliarAgency);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.agency).toBe("DOITT");
    }
  });

  it("carries through a field this schema has never seen before (.passthrough)", () => {
    const parsed = Nyc311RawRecordSchema.safeParse({
      ...normalWithBbl,
      some_brand_new_soda_field: "unexpected",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect((parsed.data as Record<string, unknown>).some_brand_new_soda_field).toBe("unexpected");
    }
  });

  it("rejects a record missing unique_key", () => {
    expect(Nyc311RawRecordSchema.safeParse(missingUniqueKey).success).toBe(false);
  });

  it("rejects a record missing created_date", () => {
    expect(Nyc311RawRecordSchema.safeParse(missingCreatedDate).success).toBe(false);
  });

  it("rejects empty-string required fields", () => {
    expect(Nyc311RawRecordSchema.safeParse(emptyRequiredFields).success).toBe(false);
  });
});
