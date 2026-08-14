import { ulid } from "ulid";
import { logInfo, logWarn } from "../../logger";
import type { RequestDao } from "../../dao/request/requestDao";
import type { Request } from "../../models/request";
import { Nyc311RawRecordSchema } from "../../models/nyc311RawRecord";
import type { IngestionCursor } from "../../models/ingestionCursor";
import type { PollResult } from "../../models/pollResult";
import { fetchNyc311Page, toSoqlTimestamp } from "./nyc311Client";

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
 * A drained window's watermark never advances past `now - SAFETY_LAG_HOURS`,
 * even if every record actually seen has a later `created_date`. The
 * Socrata feed's publish lag can be "a day+" behind `created_date`
 * (`311-test-data/pull-nyc-311-data.js`) — without this floor, a record
 * that publishes late with an earlier `created_date` than an
 * already-advanced watermark would never be queried for again
 * (`created_date > watermark` permanently excludes it).
 *
 * Originally set to 24h on that "often a day+" estimate, matching
 * {@link INITIAL_WINDOW_HOURS}. Raised to 72h (2026-08-14) after a live
 * Test-environment run observed the feed running ~47h behind real time —
 * with a 24h floor, the very first poll's window already sat entirely
 * ahead of anything the feed had published yet, permanently starving
 * ingestion (the watermark never advances, so the stuck window never
 * shrinks). {@link INITIAL_WINDOW_HOURS} deliberately stays at 24h — it
 * only bounds the one-time first-ever-run backfill (1-data-ingestion.md
 * §3), a separate concern from this floor, which applies to every run.
 * Re-querying the lag buffer on every run is safe, not wasteful — dedup via
 * `findByExternalUniqueKey` makes re-seeing an already-ingested record a
 * no-op (1-data-ingestion.md §2).
 */
const SAFETY_LAG_HOURS = 72;

/**
 * Dependencies for {@link pollNyc311}. `requestDao` is constructed by the
 * caller (`controller/ingestion/`), not here — that construction needs a
 * DynamoDB table name from a Lambda environment variable, which is the
 * controller's concern, not this service's.
 */
export interface PollNyc311Deps {
  requestDao: RequestDao;
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
export async function pollNyc311(deps: PollNyc311Deps): Promise<PollResult> {
  const { requestDao } = deps;
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
