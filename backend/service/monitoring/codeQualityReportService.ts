import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { requireEnv } from "../../env";
import { logInfo, logWarn } from "../../logger";
import { CODE_QUALITY_REPORT_DATE, CODE_QUALITY_REPORT_TIME, type CodeQualityReport, type CodeQualityReportSummary } from "../../models/codeQualityReport";
import { NotFoundError } from "../../models/errors";

/** The agent whose reports the Code Quality page shows, and their prefix in the bucket. */
export const CODE_QUALITY_AGENT = "software-analyzer-agent";
/** The most reports the list returns, newest first. */
export const CODE_QUALITY_REPORTS_MAX = 50;

export interface CodeQualityReportDeps {
  s3Client?: S3Client;
  bucket?: string;
}

interface ReportKey {
  key: string;
  date: string;
  time: string;
}

/** `software-analyzer-agent/<date>/<HH_MM>/software-analyzer-agent-<name>.md` → its parts, or null for anything else. */
export function parseReportKey(key: string): ReportKey | null {
  const parts = key.split("/");
  if (parts.length !== 4 || parts[0] !== CODE_QUALITY_AGENT) return null;
  const [, date, time, file] = parts;
  if (!CODE_QUALITY_REPORT_DATE.test(date) || !CODE_QUALITY_REPORT_TIME.test(time)) return null;
  if (!/^software-analyzer-agent-[a-z0-9][a-z0-9-]*\.md$/.test(file)) return null;
  return { key, date, time };
}

function score(value: string | undefined): number | null {
  if (value === undefined || !/^\d{1,3}$/.test(value.trim())) return null;
  const n = Number(value.trim());
  return n <= 100 ? n : null;
}

/** Splits a report into its front matter fields and the Markdown after it. */
export function parseReport(text: string, at: ReportKey): CodeQualityReport {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  const fields: Record<string, string> = {};
  for (const line of (match?.[1] ?? "").split(/\r?\n/)) {
    const pair = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) fields[pair[1]] = pair[2];
  }
  return {
    date: at.date,
    time: at.time,
    package: fields.package?.trim() || "unknown",
    score: score(fields.score),
    previous: score(fields.previous),
    markdown: match ? text.slice(match[0].length) : text,
  };
}

async function listKeys(s3: S3Client, bucket: string, prefix: string): Promise<ReportKey[]> {
  const keys: ReportKey[] = [];
  let token: string | undefined;
  do {
    const page = await s3.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: token }));
    for (const object of page.Contents ?? []) {
      const parsed = object.Key ? parseReportKey(object.Key) : null;
      if (parsed) keys.push(parsed);
      else logWarn("CodeQualityReportKeySkipped", { key: object.Key });
    }
    token = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (token);
  return keys.sort((a, b) => `${b.date}/${b.time}/${b.key}`.localeCompare(`${a.date}/${a.time}/${a.key}`));
}

async function readReport(s3: S3Client, bucket: string, at: ReportKey): Promise<CodeQualityReport> {
  const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: at.key }));
  return parseReport((await response.Body?.transformToString()) ?? "", at);
}

/** `GET /monitoring/code-quality/reports`: the newest reports' summaries, newest first. */
export async function listCodeQualityReports(deps: CodeQualityReportDeps = {}): Promise<CodeQualityReportSummary[]> {
  const s3 = deps.s3Client ?? new S3Client({});
  const bucket = deps.bucket ?? requireEnv("AGENT_REPORTS_BUCKET");
  const keys = (await listKeys(s3, bucket, `${CODE_QUALITY_AGENT}/`)).slice(0, CODE_QUALITY_REPORTS_MAX);
  logInfo("ListCodeQualityReportsKeys", { bucket, count: keys.length });
  const reports = await Promise.all(keys.map((at) => readReport(s3, bucket, at)));
  return reports.map(({ date, time, package: pkg, score: total, previous }) => ({ date, time, package: pkg, score: total, previous }));
}

/** `GET /monitoring/code-quality/reports/{date}/{time}`: that run's report, in full. */
export async function getCodeQualityReport(date: string, time: string, deps: CodeQualityReportDeps = {}): Promise<CodeQualityReport> {
  const s3 = deps.s3Client ?? new S3Client({});
  const bucket = deps.bucket ?? requireEnv("AGENT_REPORTS_BUCKET");
  const [at] = await listKeys(s3, bucket, `${CODE_QUALITY_AGENT}/${date}/${time}/`);
  if (!at) {
    logInfo("GetCodeQualityReportNotFound", { date, time });
    throw new NotFoundError(`No code quality report for ${date} ${time}`);
  }
  logInfo("GetCodeQualityReportFound", { key: at.key });
  return readReport(s3, bucket, at);
}
