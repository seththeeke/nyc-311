import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFeatureFlagController } from "../../../controller/web-api/createFeatureFlagController";
import { requireAdminUser } from "../../../controller/web-api/requireAdminUser";
import { createFeatureFlag } from "../../../service/featureFlag/featureFlagService";
import { TerminalError, ValidationError } from "../../../models/errors";
import { admin, flag, flagInput, httpEvent } from "./featureFlagTestFixtures";

vi.mock("../../../controller/web-api/requireAdminUser", () => ({ requireAdminUser: vi.fn() }));
vi.mock("../../../service/featureFlag/featureFlagService", () => ({ createFeatureFlag: vi.fn() }));
const mockedRequireAdminUser = vi.mocked(requireAdminUser);
const mockedCreate = vi.mocked(createFeatureFlag);

function event(body: string | null): unknown {
  return httpEvent({ method: "POST", path: "/admin/feature-flags", body });
}
const validBody = JSON.stringify({ flag_key: "COST_MODEL", ...flagInput });

beforeEach(() => {
  mockedRequireAdminUser.mockReset().mockResolvedValue(admin);
  mockedCreate.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createFeatureFlagController", () => {
  it("returns 201 with the created flag, attributed to the admin", async () => {
    mockedCreate.mockResolvedValue(flag);
    const response = await createFeatureFlagController(event(validBody));
    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body as string)).toEqual(flag);
    expect(mockedCreate).toHaveBeenCalledWith({ flag_key: "COST_MODEL", ...flagInput }, "01ADMIN");
  });

  it("returns 400 for a malformed event, bad JSON, or an invalid body", async () => {
    expect((await createFeatureFlagController({})).statusCode).toBe(400);
    expect((await createFeatureFlagController(event("{nope"))).statusCode).toBe(400);
    expect((await createFeatureFlagController(event(null))).statusCode).toBe(400);
    const invalid = JSON.stringify({ flag_key: "COST_MODEL", ...flagInput, default_treatment: "OTHER" });
    expect((await createFeatureFlagController(event(invalid))).statusCode).toBe(400);
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it("returns 409 when the key already exists", async () => {
    mockedCreate.mockRejectedValue(new TerminalError("conditional check failed"));
    expect((await createFeatureFlagController(event(validBody))).statusCode).toBe(409);
  });

  it("returns 400 on a ValidationError and 500 otherwise", async () => {
    mockedCreate.mockRejectedValueOnce(new ValidationError("bad")).mockRejectedValueOnce("boom");
    expect((await createFeatureFlagController(event(validBody))).statusCode).toBe(400);
    expect((await createFeatureFlagController(event(validBody))).statusCode).toBe(500);
  });
});
