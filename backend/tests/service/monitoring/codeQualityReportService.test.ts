import { GetObjectCommand, ListObjectsV2Command, S3Client, type GetObjectCommandOutput } from "@aws-sdk/client-s3";
import { mockClient } from "aws-sdk-client-mock";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "../../../models/errors";
import {
  CODE_QUALITY_REPORTS_MAX,
  getCodeQualityReport,
  listCodeQualityReports,
  parseReport,
  parseReportKey,
} from "../../../service/monitoring/codeQualityReportService";

const s3Mock = mockClient(S3Client);
const s3Client = new S3Client({});
const deps = { s3Client, bucket: "reports" };

/* The service only calls `Body.transformToString()`; a minimal stand-in is enough. */
const body = (text: string): GetObjectCommandOutput => ({ Body: { transformToString: async () => text } }) as unknown as GetObjectCommandOutput;
const report = (pkg: string, score: number, previous = "none") => `---\npackage: ${pkg}\nscore: ${score}\nprevious: ${previous}\n---\n# ${pkg} · ${score}/100\n`;
const key = (date: string, time: string, pkg: string) => `software-analyzer-agent/${date}/${time}/software-analyzer-agent-${pkg}.md`;

beforeEach(() => {
  s3Mock.reset();
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  delete process.env.AGENT_REPORTS_BUCKET;
});

describe("parseReportKey", () => {
  it("accepts only a report of Sable's at <date>/<HH_MM>/", () => {
    expect(parseReportKey(key("2026-11-09", "23_30", "backend"))).toEqual({ key: key("2026-11-09", "23_30", "backend"), date: "2026-11-09", time: "23_30" });
    for (const bad of [
      "software-analyzer-agent/2026-11-09/23_30/",
      "software-analyzer-agent/nov-09/23_30/software-analyzer-agent-backend.md",
      "software-analyzer-agent/2026-11-09/2330/software-analyzer-agent-backend.md",
      "software-analyzer-agent/2026-11-09/23_30/aws-cost-agent-x.md",
      "aws-cost-agent/2026-11-09/23_30/software-analyzer-agent-backend.md",
      "software-analyzer-agent/2026-11-09/23_30/x/software-analyzer-agent-backend.md",
    ]) {
      expect(parseReportKey(bad)).toBeNull();
    }
  });
});

describe("parseReport", () => {
  const at = { key: "k", date: "2026-11-09", time: "23_30" };

  it("reads the front matter and strips it from the Markdown", () => {
    expect(parseReport(report("backend", 62, "58"), at)).toEqual({ date: "2026-11-09", time: "23_30", package: "backend", score: 62, previous: 58, markdown: "# backend · 62/100\n" });
  });

  it("tolerates a missing or broken front matter", () => {
    expect(parseReport("# no header", at)).toMatchObject({ package: "unknown", score: null, previous: null, markdown: "# no header" });
    expect(parseReport("---\r\npackage: cdk\r\nscore: 140\r\nprevious: x\r\n---\r\nbody", at)).toMatchObject({ package: "cdk", score: null, previous: null, markdown: "body" });
  });
});

describe("listCodeQualityReports", () => {
  it("lists every page, skips foreign keys, and returns summaries newest first", async () => {
    s3Mock
      .on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: key("2026-11-05", "23_30", "web-app") }, { Key: "software-analyzer-agent/readme.txt" }, {}], IsTruncated: true, NextContinuationToken: "t1" })
      .resolvesOnce({ Contents: [{ Key: key("2026-11-09", "23_30", "backend") }], IsTruncated: false });
    s3Mock.on(GetObjectCommand, { Key: key("2026-11-05", "23_30", "web-app") }).resolves(body(report("web-app", 71)));
    s3Mock.on(GetObjectCommand, { Key: key("2026-11-09", "23_30", "backend") }).resolves(body(report("backend", 62, "58")));

    expect(await listCodeQualityReports(deps)).toEqual([
      { date: "2026-11-09", time: "23_30", package: "backend", score: 62, previous: 58 },
      { date: "2026-11-05", time: "23_30", package: "web-app", score: 71, previous: null },
    ]);
    expect(s3Mock.commandCalls(ListObjectsV2Command)[1].args[0].input).toMatchObject({ Bucket: "reports", Prefix: "software-analyzer-agent/", ContinuationToken: "t1" });
  });

  it("returns at most the newest reports, and reads the bucket from the environment", async () => {
    const contents = Array.from({ length: CODE_QUALITY_REPORTS_MAX + 5 }, (_, i) => ({ Key: key(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`, `0${i % 10}_00`, "cdk") }));
    s3Mock.on(ListObjectsV2Command).resolves({ Contents: contents });
    s3Mock.on(GetObjectCommand).resolves({ Body: undefined } as unknown as GetObjectCommandOutput);
    process.env.AGENT_REPORTS_BUCKET = "env-bucket";
    const reports = await listCodeQualityReports({ s3Client });
    expect(reports).toHaveLength(CODE_QUALITY_REPORTS_MAX);
    expect(reports[0]).toMatchObject({ date: "2026-01-28", package: "unknown" });
    expect(s3Mock.commandCalls(ListObjectsV2Command)[0].args[0].input.Bucket).toBe("env-bucket");
  });

  it("fails without a bucket", async () => {
    await expect(listCodeQualityReports({ s3Client })).rejects.toThrow("AGENT_REPORTS_BUCKET");
  });

  it("uses a real S3 client by default", async () => {
    await expect(listCodeQualityReports()).rejects.toThrow("AGENT_REPORTS_BUCKET");
  });
});

describe("getCodeQualityReport", () => {
  it("returns that run's report in full", async () => {
    s3Mock.on(ListObjectsV2Command, { Prefix: "software-analyzer-agent/2026-11-09/23_30/" }).resolves({ Contents: [{ Key: key("2026-11-09", "23_30", "backend") }] });
    s3Mock.on(GetObjectCommand).resolves(body(report("backend", 62, "58")));
    expect(await getCodeQualityReport("2026-11-09", "23_30", deps)).toMatchObject({ package: "backend", score: 62, markdown: "# backend · 62/100\n" });
  });

  it("throws NotFoundError when the run has no report", async () => {
    s3Mock.on(ListObjectsV2Command).resolves({});
    await expect(getCodeQualityReport("2026-11-09", "23_30", deps)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reads the bucket from the environment with a real client by default", async () => {
    await expect(getCodeQualityReport("2026-11-09", "23_30")).rejects.toThrow("AGENT_REPORTS_BUCKET");
  });
});
