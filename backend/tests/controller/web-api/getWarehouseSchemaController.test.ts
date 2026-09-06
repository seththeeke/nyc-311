import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getWarehouseSchema } from "../../../service/analytics/warehouseSchemaService";
import { getWarehouseSchemaController } from "../../../controller/web-api/getWarehouseSchemaController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/warehouseSchemaService", () => ({ getWarehouseSchema: vi.fn() }));
const mocked = vi.mocked(getWarehouseSchema);

const validEvent = { rawPath: "/data/schema", requestContext: { http: { method: "GET" } } };

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getWarehouseSchemaController", () => {
  it("returns 200 with the live schema", async () => {
    mocked.mockResolvedValue({ tables: [{ table_name: "order_events", columns: [] }] });

    const res = await getWarehouseSchemaController(validEvent);

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual({ tables: [{ table_name: "order_events", columns: [] }] });
  });

  it("returns 400 for a malformed event without calling the service", async () => {
    const res = await getWarehouseSchemaController({ not: "an-api-event" });
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("glue unavailable"));
    const res = await getWarehouseSchemaController(validEvent);
    expect(res.statusCode).toBe(500);
  });

  it("maps a ValidationError from the service to 400", async () => {
    mocked.mockRejectedValue(new ValidationError("bad", []));
    const res = await getWarehouseSchemaController(validEvent);
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mocked.mockRejectedValue("string failure");
    const res = await getWarehouseSchemaController(validEvent);
    expect(res.statusCode).toBe(500);
  });
});
