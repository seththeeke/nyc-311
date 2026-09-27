import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getTreatmentController } from "../../../controller/web-api/getTreatmentController";
import { evaluateFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { NotFoundError } from "../../../models/errors";
import { httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../service/featureFlag/featureFlagService", () => ({ evaluateFeatureFlag: vi.fn() }));
const mockedEvaluate = vi.mocked(evaluateFeatureFlag);

function event(flagKey: string | undefined, body: string | null): unknown {
  return httpEvent({
    method: "POST",
    path: `/feature-flags/${flagKey}/treatment`,
    pathParameters: flagKey ? { flag_key: flagKey } : undefined,
    body,
  });
}

beforeEach(() => {
  mockedEvaluate.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getTreatmentController", () => {
  it("returns 200 with only flag_key and treatment", async () => {
    mockedEvaluate.mockResolvedValue("ML");
    const response = await getTreatmentController(event("COST_MODEL", JSON.stringify({ context: { operator_id: "op-1" } })));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body as string)).toEqual({ flag_key: "COST_MODEL", treatment: "ML" });
    expect(mockedEvaluate).toHaveBeenCalledWith("COST_MODEL", { operator_id: "op-1" });
  });

  it("returns 400 for a malformed event or flag key", async () => {
    expect((await getTreatmentController({})).statusCode).toBe(400);
    expect((await getTreatmentController(event(undefined, "{}"))).statusCode).toBe(400);
  });

  it("returns 400 for unparseable JSON, a missing body, or an unsupported context field", async () => {
    expect((await getTreatmentController(event("COST_MODEL", "{not json"))).statusCode).toBe(400);
    expect((await getTreatmentController(event("COST_MODEL", null))).statusCode).toBe(400);
    expect((await getTreatmentController(event("COST_MODEL", JSON.stringify({ context: { order_id: "o" } })))).statusCode).toBe(400);
    expect(mockedEvaluate).not.toHaveBeenCalled();
  });

  it("returns 404 when the flag doesn't exist", async () => {
    mockedEvaluate.mockRejectedValue(new NotFoundError("No feature flag MISSING"));
    expect((await getTreatmentController(event("MISSING", JSON.stringify({ context: {} })))).statusCode).toBe(404);
  });

  it("returns 500 for any other failure", async () => {
    mockedEvaluate.mockRejectedValue("boom");
    expect((await getTreatmentController(event("COST_MODEL", JSON.stringify({ context: {} })))).statusCode).toBe(500);
  });
});
