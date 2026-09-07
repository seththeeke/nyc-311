import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listReports } from "../../../service/analytics/reportsService";
import { getReportsController } from "../../../controller/web-api/getReportsController";
import { ValidationError } from "../../../models/errors";

vi.mock("../../../service/analytics/reportsService", () => ({ listReports: vi.fn() }));
const mocked = vi.mocked(listReports);

const RESPONSE = {
  reports: [
    {
      job_name: "order_volume_by_stage_8w",
      title: "Order volume by stage — 8-week trend",
      run_date: "2026-09-07",
      computed_at: "2026-09-07T14:16:36.410Z",
      week_column: "week_start",
      series_column: "stage",
      value_column: "order_count",
      series: ["SCHEDULE"],
      weeks: [{ week: "2026-07-13", values: { SCHEDULE: 30 } }],
    },
  ],
};

const EVENT = { rawPath: "/reports", requestContext: { http: { method: "GET" } } };

beforeEach(() => {
  mocked.mockReset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getReportsController", () => {
  it("returns 200 with the reports payload", async () => {
    mocked.mockResolvedValue(RESPONSE);
    const res = await getReportsController(EVENT);
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body as string)).toEqual(RESPONSE);
  });

  it("returns 400 for a malformed event, without calling the service", async () => {
    const res = await getReportsController({ not: "an-event" });
    expect(res.statusCode).toBe(400);
    expect(mocked).not.toHaveBeenCalled();
  });

  it("returns 500 when the service throws", async () => {
    mocked.mockRejectedValue(new Error("s3 unavailable"));
    const res = await getReportsController(EVENT);
    expect(res.statusCode).toBe(500);
  });

  it("maps a ValidationError from the service to 400", async () => {
    mocked.mockRejectedValue(new ValidationError("bad envelope", []));
    const res = await getReportsController(EVENT);
    expect(res.statusCode).toBe(400);
  });

  it("returns 500 when the service throws a non-Error value", async () => {
    mocked.mockRejectedValue("string failure");
    const res = await getReportsController(EVENT);
    expect(res.statusCode).toBe(500);
  });
});
