import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../../service/monitoring/codeQualityReportService", () => ({ listCodeQualityReports: vi.fn(), getCodeQualityReport: vi.fn() }));

import { getCodeQualityReportController } from "../../../../controller/web-api/monitoring/getCodeQualityReportController";
import { getCodeQualityReportsController } from "../../../../controller/web-api/monitoring/getCodeQualityReportsController";
import { NotFoundError } from "../../../../models/errors";
import { getCodeQualityReport, listCodeQualityReports } from "../../../../service/monitoring/codeQualityReportService";

const listEvent = { rawPath: "/monitoring/code-quality/reports", requestContext: { http: { method: "GET" } } };
const getEvent = (date: string, time: string) => ({ ...listEvent, rawPath: `/monitoring/code-quality/reports/${date}/${time}`, pathParameters: { date, time } });
const summary = { date: "2026-11-09", time: "23_30", package: "backend", score: 62, previous: 58 };

beforeEach(() => {
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.mocked(listCodeQualityReports).mockReset();
  vi.mocked(getCodeQualityReport).mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getCodeQualityReportsController", () => {
  it("returns the reports", async () => {
    vi.mocked(listCodeQualityReports).mockResolvedValue([summary]);
    const response = await getCodeQualityReportsController(listEvent);
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toEqual({ reports: [summary] });
  });

  it("rejects a malformed event", async () => {
    expect((await getCodeQualityReportsController({})).statusCode).toBe(400);
  });

  it.each([new Error("denied"), "boom"])("maps a failure (%s) to 500", async (failure) => {
    vi.mocked(listCodeQualityReports).mockRejectedValue(failure);
    expect((await getCodeQualityReportsController(listEvent)).statusCode).toBe(500);
  });
});

describe("getCodeQualityReportController", () => {
  it("returns the report", async () => {
    vi.mocked(getCodeQualityReport).mockResolvedValue({ ...summary, markdown: "# backend" });
    const response = await getCodeQualityReportController(getEvent("2026-11-09", "23_30"));
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(String(response.body))).toMatchObject({ package: "backend", markdown: "# backend" });
    expect(getCodeQualityReport).toHaveBeenCalledWith("2026-11-09", "23_30");
  });

  it("rejects a malformed event or path", async () => {
    expect((await getCodeQualityReportController({})).statusCode).toBe(400);
    expect((await getCodeQualityReportController(getEvent("nov-9", "23_30"))).statusCode).toBe(400);
    expect((await getCodeQualityReportController(getEvent("2026-11-09", "../x"))).statusCode).toBe(400);
    expect((await getCodeQualityReportController(listEvent)).statusCode).toBe(400);
    expect(getCodeQualityReport).not.toHaveBeenCalled();
  });

  it("maps a missing report to 404 and anything else to 500", async () => {
    vi.mocked(getCodeQualityReport).mockRejectedValueOnce(new NotFoundError("none"));
    expect((await getCodeQualityReportController(getEvent("2026-11-09", "23_30"))).statusCode).toBe(404);
    vi.mocked(getCodeQualityReport).mockRejectedValueOnce("boom");
    expect((await getCodeQualityReportController(getEvent("2026-11-09", "23_30"))).statusCode).toBe(500);
  });
});
