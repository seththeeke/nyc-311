import { ulid } from "ulid";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import type { AttributeValue } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { logInfo, logWarn } from "../../logger";
import { RequestDao } from "../../dao/request/requestDao";
import type { Request } from "../../models/request";
import { Nyc311RawRecordSchema } from "../../models/nyc311RawRecord";
import type { IngestionCursor, IngestionCursorStatus } from "../../models/ingestionCursor";
import type { PollResult } from "../../models/pollResult";
import type { PollerMetrics } from "../../models/pollerMetrics";
import type { RequestStreamRecord } from "../../models/requestStreamEvent";
import { fetchNyc311Page, toSoqlTimestamp } from "./nyc311Client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/*
 * Constructed lazily inside each function that needs one, not at module
 * scope — per CLAUDE.md §5.2 (revised 2026-08-22). This file's exports
 * cover two unrelated legs (poller and stream fan-out); a module-scope
 * default here previously required REQUESTS_TABLE_NAME on import even for
 * fanOutRequestRecord, which never touches this DAO — the gap that left
 * the fan-out Lambda crashing on every invocation since it shipped.
 */
function getDefaultRequestDao(): RequestDao {
  return new RequestDao(DynamoDBDocumentClient.from(new DynamoDBClient({})), requireEnv("REQUESTS_TABLE_NAME"));
}

/**
 * No unbounded historical backfill on the very first-ever run (no cursor
 * item yet) — 1-data-ingestion.md §3.
 */
const INITIAL_WINDOW_HOURS = 24;

/** Records requested per SODA API call. */
const PAGE_SIZE = 1000;

/** Records looked at (accepted + rejected + duplicate) per Lambda invocation — 1-data-ingestion.md §3. */
const PER_RUN_RECORD_CAP = 2000;

/**
 * A drained window's watermark never advances past `now - SAFETY_LAG_HOURS`
 * — the Socrata feed can publish a day+ late, so a record with an earlier
 * `created_date` than an already-advanced watermark would never be queried
 * again. Raised from 24h to 72h (2026-08-14) after a live run observed
 * ~47h of real lag permanently starving ingestion at the old floor.
 * {@link INITIAL_WINDOW_HOURS} is a separate, still-24h concern (§3's
 * one-time first-run backfill bound).
 */
const SAFETY_LAG_HOURS = 72;

/**
 * Dependencies for {@link pollNyc311}. `requestDao` defaults to a freshly
 * constructed `RequestDao` (see {@link getDefaultRequestDao}) — tests
 * override it with a mock; `controller/ingestion/` never passes one, since
 * controllers don't construct or touch a DAO at all (CLAUDE.md §5.2).
 */
export interface PollNyc311Deps {
  requestDao?: RequestDao;
  now?: () => Date;
  fetchPage?: typeof fetchNyc311Page;
}

function parseSodaTimestamp(raw: string): Date {
  return new Date(`${raw}Z`);
}

/** Never advances past `now - SAFETY_LAG_HOURS`, and never regresses before `windowStartDate`. */
function cappedWatermark(now: Date, windowStartDate: Date, lastCreatedDateSeen: Date | null): Date {
  const safeCutoff = new Date(now.getTime() - SAFETY_LAG_HOURS * 60 * 60 * 1000);
  const candidate = lastCreatedDateSeen ?? windowStartDate;
  const capped = candidate < safeCutoff ? candidate : safeCutoff;
  return capped > windowStartDate ? capped : windowStartDate;
}

/**
 * Runs one NYC 311 poll: reads the cursor, pages the SODA API from where
 * the last run left off, dedupes and writes new `DRAFT` Requests, and
 * persists the updated cursor. Entered by `controller/ingestion/` on every
 * EventBridge Scheduler trigger — see 1-data-ingestion.md for the full
 * design (cursor semantics §2, pagination/cap §3, lenient validation §4).
 */
export async function pollNyc311(deps: PollNyc311Deps = {}): Promise<PollResult> {
  const requestDao = deps.requestDao ?? getDefaultRequestDao();
  const now = deps.now ?? (() => new Date());
  const fetchPage = deps.fetchPage ?? fetchNyc311Page;

  const cursor = await requestDao.getCursor();
  logInfo("PollStarted", { cursor });

  const windowStartDate = cursor?.last_watermark
    ? parseSodaTimestamp(cursor.last_watermark)
    : new Date(now().getTime() - INITIAL_WINDOW_HOURS * 60 * 60 * 1000);
  const sinceExclusive = toSoqlTimestamp(windowStartDate);
  let offset = cursor?.resume_offset ?? 0;
  logInfo("PollWindowComputed", {
    isFirstRun: cursor === null,
    sinceExclusive,
    startingOffset: offset,
  });

  let recordsIngested = 0;
  let duplicatesSkipped = 0;
  let recordsRejected = 0;
  let recordsProcessedThisRun = 0;
  let lastCreatedDateSeen: Date | null = null;
  let drained = false;
  let pageNumber = 0;

  while (recordsProcessedThisRun < PER_RUN_RECORD_CAP) {
    pageNumber += 1;
    const pageLimit = Math.min(PAGE_SIZE, PER_RUN_RECORD_CAP - recordsProcessedThisRun);
    logInfo("PollFetchingPage", { pageNumber, sinceExclusive, offset, pageLimit });
    const page = await fetchPage({ sinceExclusive, offset, limit: pageLimit });
    logInfo("PollPageFetched", { pageNumber, recordCount: page.length, pageLimit });

    for (const rawRecord of page) {
      const parsed = Nyc311RawRecordSchema.safeParse(rawRecord);
      if (!parsed.success) {
        recordsRejected += 1;
        logWarn("PollRecordRejected", {
          uniqueKeyGuess: (rawRecord as Record<string, unknown> | null)?.["unique_key"],
          issues: parsed.error.issues,
        });
        continue;
      }
      const record = parsed.data;
      const recordCreatedDate = parseSodaTimestamp(record.created_date);
      if (!lastCreatedDateSeen || recordCreatedDate > lastCreatedDateSeen) {
        lastCreatedDateSeen = recordCreatedDate;
      }

      const existing = await requestDao.findByExternalUniqueKey(record.unique_key);
      if (existing) {
        duplicatesSkipped += 1;
        logInfo("PollRecordDuplicateSkipped", {
          externalUniqueKey: record.unique_key,
          existingRequestId: existing.request_id,
        });
        continue;
      }

      const request: Request = {
        request_id: ulid(),
        source: "NYC_311",
        external_unique_key: record.unique_key,
        location_id: null,
        complaint_type: record.complaint_type ?? null,
        descriptor: record.descriptor ?? null,
        agency: record.agency ?? null,
        raw_payload: record,
        status: "DRAFT",
        created_by: null,
        created_at: record.created_date,
      };
      await requestDao.putRequest(request);
      recordsIngested += 1;
      logInfo("PollRecordIngested", {
        requestId: request.request_id,
        externalUniqueKey: request.external_unique_key,
        complaintType: request.complaint_type,
      });
    }

    offset += page.length;
    recordsProcessedThisRun += page.length;

    if (page.length < pageLimit) {
      drained = true;
      logInfo("PollWindowDrained", { pageNumber, recordsProcessedThisRun });
      break;
    }
  }
  if (!drained) {
    logInfo("PollStoppedAtRecordCap", { pageNumber, recordsProcessedThisRun, nextOffset: offset });
  }

  const newCursor: IngestionCursor = drained
    ? {
        last_watermark: toSoqlTimestamp(cappedWatermark(now(), windowStartDate, lastCreatedDateSeen)),
        resume_offset: null,
      }
    : { last_watermark: sinceExclusive, resume_offset: offset };
  logInfo("PollCursorAdvancing", { previousCursor: cursor, newCursor });
  await requestDao.putCursor(newCursor);

  logInfo("PollCompleted", {
    records_ingested: recordsIngested,
    duplicates_skipped: duplicatesSkipped,
    records_rejected: recordsRejected,
  });

  return { recordsIngested, duplicatesSkipped, recordsRejected };
}

/** Dependencies for {@link recordPollerMetrics} and {@link listPollerMetrics} — see {@link PollNyc311Deps}. */
export interface RequestDaoDeps {
  requestDao?: RequestDao;
}

/**
 * Persists one poller run's outcome (1-data-ingestion.md §8a). Entered by
 * both `controller/ingestion/nyc311PollerController.ts` (after every run,
 * success or failure) and, indirectly, nothing else — kept alongside
 * `pollNyc311` rather than a separate `service/metrics/` module since it's
 * describing the exact same poll this file already runs, not a distinct
 * concern.
 */
export async function recordPollerMetrics(metrics: PollerMetrics, deps: RequestDaoDeps = {}): Promise<void> {
  const requestDao = deps.requestDao ?? getDefaultRequestDao();
  logInfo("RecordPollerMetricsStarted", { metrics });
  await requestDao.putPollerMetrics(metrics);
  logInfo("RecordPollerMetricsCompleted", {});
}

/**
 * Returns the NYC 311 poller's full run history, most recent first — the
 * only query behind the public ingestion-metrics API
 * (`controller/web-api/getPollerMetricsController.ts`, 1-data-ingestion.md
 * §8a).
 */
export async function listPollerMetrics(deps: RequestDaoDeps = {}): Promise<PollerMetrics[]> {
  const requestDao = deps.requestDao ?? getDefaultRequestDao();
  logInfo("ListPollerMetricsStarted", {});
  const metrics = await requestDao.listPollerMetrics();
  logInfo("ListPollerMetricsCompleted", { count: metrics.length });
  return metrics;
}

/**
 * A watermark lagging "now" by more than this is a sign the poller isn't
 * draining its window (a healthy, fully-drained cursor sits at roughly
 * `SAFETY_LAG_HOURS`) — the exact shape of the fan-out-Lambda incident this
 * flag was added to catch (a ~12-day lag, found only by manual investigation).
 */
const STALE_LAG_MULTIPLIER = 2;

/** Dependencies for {@link getCursorStatus} — see {@link PollNyc311Deps}. */
export interface GetCursorStatusDeps {
  requestDao?: RequestDao;
  now?: () => Date;
}

/**
 * The poller's ingestion cursor plus a computed staleness signal — backs
 * the cursor section of `GET /ingestion/metrics`
 * (`controller/web-api/getPollerMetricsController.ts`). `null` when no
 * cursor item exists yet (no poll has ever completed a run).
 */
export async function getCursorStatus(deps: GetCursorStatusDeps = {}): Promise<IngestionCursorStatus | null> {
  const requestDao = deps.requestDao ?? getDefaultRequestDao();
  const now = deps.now ?? (() => new Date());

  logInfo("GetCursorStatusStarted", {});
  const cursor = await requestDao.getCursor();
  if (!cursor) {
    logInfo("GetCursorStatusCompleted", { cursor: null });
    return null;
  }

  const lagHours = cursor.last_watermark
    ? (now().getTime() - parseSodaTimestamp(cursor.last_watermark).getTime()) / (60 * 60 * 1000)
    : null;
  const status: IngestionCursorStatus = {
    last_watermark: cursor.last_watermark,
    resume_offset: cursor.resume_offset,
    lag_hours: lagHours,
    is_stale: lagHours !== null && lagHours > SAFETY_LAG_HOURS * STALE_LAG_MULTIPLIER,
  };
  logInfo("GetCursorStatusCompleted", { status });
  return status;
}

/**
 * Dependencies for {@link fanOutRequestRecord}. Both default to a freshly
 * constructed client/env lookup — tests override them with mocks/fakes.
 */
export interface RequestFanOutDeps {
  sqsClient?: SQSClient;
  queueUrl?: string;
}

/**
 * Decides whether a DynamoDB Streams record is a real, newly-ingested
 * `Request` worth acting on — per `3-order-ingestion.md` §2.1's in-handler
 * filtering design (deliberately not `FilterCriteria` on the event source
 * mapping). `eventName !== "INSERT"` excludes this pipeline's own
 * promote-and-write-back `MODIFY`s; a missing `external_unique_key`
 * excludes the `CURSOR#NYC_311` sentinel and every poller-metrics
 * `METRIC#<ulid>` row, neither of which ever sets that field.
 */
function isRelevantRequestRecord(record: RequestStreamRecord): boolean {
  return record.eventName === "INSERT" && typeof record.dynamodb.NewImage?.["external_unique_key"] !== "undefined";
}

/**
 * Fans out one relevant `Request` INSERT onto the order-ingestion SQS
 * queue (`3-order-ingestion.md` §2.1) — no filter/promotion logic, no DAO
 * calls; the not-yet-built downstream processor owns all of that and
 * `zod`-validates the plain-JSON payload published here. An irrelevant
 * record is a normal no-op, never a `batchItemFailure`.
 */
export async function fanOutRequestRecord(record: RequestStreamRecord, deps: RequestFanOutDeps = {}): Promise<void> {
  const sqsClient = deps.sqsClient ?? new SQSClient({});
  const queueUrl = deps.queueUrl ?? requireEnv("ORDER_INGESTION_QUEUE_URL");

  if (!isRelevantRequestRecord(record)) {
    logInfo("RequestStreamRecordSkipped", {
      eventName: record.eventName,
      sequenceNumber: record.dynamodb.SequenceNumber,
    });
    return;
  }

  const request = unmarshall(record.dynamodb.NewImage as Record<string, AttributeValue>);
  logInfo("RequestStreamRecordUnmarshalled", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    requestId: request["request_id"],
  });

  await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(request),
    })
  );
  logInfo("RequestStreamRecordFannedOut", {
    sequenceNumber: record.dynamodb.SequenceNumber,
    requestId: request["request_id"],
  });
}
