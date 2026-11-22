import { describe, expect, it } from "vitest";
import {
  CLOSED_FEATURE_REQUEST_STATUS,
  FEATURE_REQUEST_STATUSES,
  FeatureRequestSchema,
  FeatureRequestStatusSchema,
  SERVICE_REQUEST_STATUSES,
  ServiceRequestSchema,
  ServiceRequestStatusSchema,
} from "../../models/boroughSimPublicApi";

describe("BoroughSim status parsers", () => {
  it("accept every known status", () => {
    for (const status of SERVICE_REQUEST_STATUSES) expect(ServiceRequestStatusSchema.parse(status)).toBe(status);
    for (const status of FEATURE_REQUEST_STATUSES) expect(FeatureRequestStatusSchema.parse(status)).toBe(status);
  });

  /* The public API is additive-only: a status BoroughSim adds later must still parse. */
  it("pass an unknown status through unchanged", () => {
    expect(ServiceRequestStatusSchema.parse("ON_HOLD")).toBe("ON_HOLD");
    expect(FeatureRequestStatusSchema.parse("DECLINED")).toBe("DECLINED");
  });

  it("reject an empty or non-string status", () => {
    expect(ServiceRequestStatusSchema.safeParse("").success).toBe(false);
    expect(FeatureRequestStatusSchema.safeParse(3).success).toBe(false);
  });

  it("are the parsers the response schemas use", () => {
    const request = { order_id: "01ORDER", status: "ON_HOLD", status_reason_description: null, scheduled_window: null, status_updated_at: "AT" };
    expect(ServiceRequestSchema.parse(request).status).toBe("ON_HOLD");
    expect(ServiceRequestSchema.safeParse({ ...request, status: "" }).success).toBe(false);
    const feature = { feature_request_id: "01FR", status: "CLOSED", status_reason_description: "Shipped", title: "T" };
    expect(FeatureRequestSchema.parse(feature).status).toBe(CLOSED_FEATURE_REQUEST_STATUS);
    expect(FeatureRequestSchema.safeParse({ ...feature, status: "" }).success).toBe(false);
  });

  it("names a closed feature request with a known status", () => {
    expect(FEATURE_REQUEST_STATUSES).toContain(CLOSED_FEATURE_REQUEST_STATUS);
  });
});
