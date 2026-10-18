import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../service/resident/residentSyncService", () => ({ syncResidents: vi.fn() }));

import { RESIDENT_SYNC_RESOURCE_ID, syncResidentsController } from "../../../controller/resident/syncResidentsController";
import { RESIDENT_SEEDS } from "../../../service/resident/residentSeeds";
import { syncResidents } from "../../../service/resident/residentSyncService";

const event = (RequestType: string) => ({ RequestType, ResourceProperties: { SeedHash: "abc", ServiceToken: "arn" } });

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.clearAllMocks());

describe("syncResidentsController", () => {
  it("syncs every bundled seed on Create and Update, under one fixed id", async () => {
    vi.mocked(syncResidents).mockResolvedValue({ hawthorn: "CREATED" });
    for (const type of ["Create", "Update"]) {
      await expect(syncResidentsController(event(type))).resolves.toEqual({ PhysicalResourceId: RESIDENT_SYNC_RESOURCE_ID, Data: { hawthorn: "CREATED" } });
    }
    expect(syncResidents).toHaveBeenCalledWith(RESIDENT_SEEDS);
  });

  it("does nothing on Delete", async () => {
    await expect(syncResidentsController(event("Delete"))).resolves.toEqual({ PhysicalResourceId: RESIDENT_SYNC_RESOURCE_ID });
    expect(syncResidents).not.toHaveBeenCalled();
  });

  it("fails the deploy on a malformed event or a failed sync", async () => {
    await expect(syncResidentsController({ RequestType: "Create" })).rejects.toThrow("Malformed custom resource event");
    vi.mocked(syncResidents).mockRejectedValue(new Error("Resident seed 0 is invalid"));
    await expect(syncResidentsController(event("Update"))).rejects.toThrow("Resident seed 0 is invalid");
  });
});
