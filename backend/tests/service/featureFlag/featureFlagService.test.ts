import { DeleteCommand, DynamoDBDocumentClient, GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeatureFlagDao } from "../../../dao/featureFlag/featureFlagDao";
import { NotFoundError } from "../../../models/errors";
import type { FeatureFlag } from "../../../models/featureFlag";
import {
  createFeatureFlag,
  deleteFeatureFlag,
  evaluateFeatureFlag,
  getFeatureFlag,
  getTreatment,
  listFeatureFlags,
  updateFeatureFlag,
} from "../../../service/featureFlag/featureFlagService";

const flag: FeatureFlag = {
  flag_key: "COST_MODEL",
  description: "",
  treatments: ["BRUTE_FORCE", "ML"],
  default_treatment: "BRUTE_FORCE",
  overrides: [{ entity_type: "OPERATOR", entity_id: "op-1", treatment: "ML" }],
  allocations: [],
  version: 3,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-02T00:00:00.000Z",
  updated_by: "01OLD",
};

const NOW = new Date("2026-09-27T12:00:00.000Z");

function mockDao(overrides: Partial<Record<keyof FeatureFlagDao, unknown>> = {}): FeatureFlagDao {
  return {
    getFlag: vi.fn().mockResolvedValue(flag),
    listFlags: vi.fn().mockResolvedValue([flag]),
    createFlag: vi.fn().mockResolvedValue(undefined),
    replaceFlag: vi.fn().mockResolvedValue(undefined),
    deleteFlag: vi.fn().mockResolvedValue(true),
    ...overrides,
  } as unknown as FeatureFlagDao;
}

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("listFeatureFlags", () => {
  it("returns flags sorted by key", async () => {
    const zed = { ...flag, flag_key: "ZED" };
    const dao = mockDao({ listFlags: vi.fn().mockResolvedValue([zed, flag]) });
    await expect(listFeatureFlags({ featureFlagDao: dao })).resolves.toEqual([flag, zed]);
  });

  it("constructs a default DAO from FEATURE_FLAGS_TABLE_NAME", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(ScanCommand).resolves({ Items: [] });
    await expect(listFeatureFlags()).resolves.toEqual([]);
    expect(ddbMock.commandCalls(ScanCommand)[0].args[0].input.TableName).toBe("FeatureFlags");
    ddbMock.restore();
  });

  it("throws when FEATURE_FLAGS_TABLE_NAME is unset", async () => {
    vi.stubEnv("FEATURE_FLAGS_TABLE_NAME", "");
    await expect(listFeatureFlags()).rejects.toThrow("FEATURE_FLAGS_TABLE_NAME");
    vi.unstubAllEnvs();
  });
});

describe("getFeatureFlag", () => {
  it("returns the flag", async () => {
    await expect(getFeatureFlag("COST_MODEL", { featureFlagDao: mockDao() })).resolves.toEqual(flag);
  });

  it("throws NotFoundError when missing", async () => {
    const dao = mockDao({ getFlag: vi.fn().mockResolvedValue(null) });
    await expect(getFeatureFlag("MISSING", { featureFlagDao: dao })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("uses the default DAO when none is injected", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(GetCommand).resolves({ Item: flag });
    await expect(getFeatureFlag("COST_MODEL")).resolves.toEqual(flag);
    ddbMock.restore();
  });
});

describe("createFeatureFlag", () => {
  it("stamps version 1 and audit fields", async () => {
    const dao = mockDao();
    const { flag_key, description, treatments, default_treatment, overrides, allocations } = flag;
    const created = await createFeatureFlag(
      { flag_key, description, treatments, default_treatment, overrides, allocations },
      "01ADMIN",
      { featureFlagDao: dao, now: () => NOW }
    );
    expect(created).toEqual({
      ...flag,
      version: 1,
      created_at: NOW.toISOString(),
      updated_at: NOW.toISOString(),
      updated_by: "01ADMIN",
    });
    expect(dao.createFlag).toHaveBeenCalledWith(created);
  });

  it("uses the real clock and default DAO when not injected", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    const created = await createFeatureFlag(
      { flag_key: "NEW", description: "", treatments: ["ON", "OFF"], default_treatment: "OFF", overrides: [], allocations: [] },
      "01ADMIN"
    );
    expect(created.version).toBe(1);
    expect(Date.parse(created.created_at)).not.toBeNaN();
    ddbMock.restore();
  });
});

describe("updateFeatureFlag", () => {
  it("replaces the config, bumps the version, and keeps created_at", async () => {
    const dao = mockDao();
    const updated = await updateFeatureFlag(
      "COST_MODEL",
      {
        expected_version: 3,
        description: "changed",
        treatments: ["BRUTE_FORCE", "ML"],
        default_treatment: "ML",
        overrides: [],
        allocations: [{ treatment: "BRUTE_FORCE", percent: 50 }],
      },
      "01ADMIN",
      { featureFlagDao: dao, now: () => NOW }
    );
    expect(updated).toEqual({
      flag_key: "COST_MODEL",
      description: "changed",
      treatments: ["BRUTE_FORCE", "ML"],
      default_treatment: "ML",
      overrides: [],
      allocations: [{ treatment: "BRUTE_FORCE", percent: 50 }],
      version: 4,
      created_at: flag.created_at,
      updated_at: NOW.toISOString(),
      updated_by: "01ADMIN",
    });
    expect(dao.replaceFlag).toHaveBeenCalledWith(updated, 3);
  });

  it("throws NotFoundError for a missing flag without writing", async () => {
    const dao = mockDao({ getFlag: vi.fn().mockResolvedValue(null) });
    const request = { expected_version: 1, description: "", treatments: ["A"], default_treatment: "A", overrides: [], allocations: [] };
    await expect(updateFeatureFlag("MISSING", request, "01ADMIN", { featureFlagDao: dao })).rejects.toBeInstanceOf(NotFoundError);
    expect(dao.replaceFlag).not.toHaveBeenCalled();
  });

  it("uses the real clock and default DAO when not injected", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(GetCommand).resolves({ Item: flag });
    const request = { expected_version: 3, description: "", treatments: ["A"], default_treatment: "A", overrides: [], allocations: [] };
    const updated = await updateFeatureFlag("COST_MODEL", request, "01ADMIN");
    expect(updated.version).toBe(4);
    ddbMock.restore();
  });
});

describe("deleteFeatureFlag", () => {
  it("deletes an existing flag", async () => {
    const dao = mockDao();
    await deleteFeatureFlag("COST_MODEL", "01ADMIN", { featureFlagDao: dao });
    expect(dao.deleteFlag).toHaveBeenCalledWith("COST_MODEL");
  });

  it("throws NotFoundError when nothing was deleted", async () => {
    const dao = mockDao({ deleteFlag: vi.fn().mockResolvedValue(false) });
    await expect(deleteFeatureFlag("MISSING", "01ADMIN", { featureFlagDao: dao })).rejects.toBeInstanceOf(NotFoundError);
  });

  it("uses the default DAO when none is injected", async () => {
    const ddbMock = mockClient(DynamoDBDocumentClient);
    ddbMock.on(DeleteCommand).resolves({ Attributes: flag });
    await expect(deleteFeatureFlag("COST_MODEL", "01ADMIN")).resolves.toBeUndefined();
    ddbMock.restore();
  });
});

describe("evaluateFeatureFlag", () => {
  it("returns the chosen treatment", async () => {
    const dao = mockDao();
    await expect(evaluateFeatureFlag("COST_MODEL", { operator_id: "op-1" }, { featureFlagDao: dao })).resolves.toBe("ML");
    await expect(evaluateFeatureFlag("COST_MODEL", {}, { featureFlagDao: dao, random: () => 0 })).resolves.toBe("BRUTE_FORCE");
  });

  it("throws NotFoundError for a missing flag", async () => {
    const dao = mockDao({ getFlag: vi.fn().mockResolvedValue(null) });
    await expect(evaluateFeatureFlag("MISSING", {}, { featureFlagDao: dao })).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("getTreatment", () => {
  it("returns the evaluated treatment", async () => {
    const dao = mockDao();
    await expect(getTreatment("COST_MODEL", { operator_id: "op-1" }, { fallback: "BRUTE_FORCE" }, { featureFlagDao: dao })).resolves.toBe("ML");
  });

  it("returns the fallback for a missing flag", async () => {
    const dao = mockDao({ getFlag: vi.fn().mockResolvedValue(null) });
    await expect(getTreatment("MISSING", {}, { fallback: "SAFE" }, { featureFlagDao: dao })).resolves.toBe("SAFE");
  });

  it("rethrows other failures", async () => {
    const dao = mockDao({ getFlag: vi.fn().mockRejectedValue(new Error("throttled")) });
    await expect(getTreatment("COST_MODEL", {}, { fallback: "SAFE" }, { featureFlagDao: dao })).rejects.toThrow("throttled");
  });
});
