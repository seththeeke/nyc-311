#!/usr/bin/env node
/**
 * One-time bulk reject (11-street-condition-implementation.md §1): every
 * Order whose complaint_type isn't "Street Condition" — including the
 * ~1.1M Orders-Test rows that predate the complaint_type field entirely
 * (11-street-condition-implementation.md §1's "no backfill" decision) —
 * gets a real ORDER_REJECTED event appended, the same terminal transition
 * StreetConditionOnlyRule now drives for every newly-evaluated Order.
 *
 * NOT read-only by default, but defaults to --dry-run reporting only;
 * pass --execute to actually write. Writes real ORDER_REJECTED events and
 * flips Order.status to "REJECTED" in DynamoDB.
 *
 * Why this can't just call the real OrderDao.rejectOrder(): that method's
 * appendEvent() re-validates the *previous* projection against the full
 * OrderSchema before folding, and OrderSchema.complaint_type is
 * `z.string().min(1).nullable()` — nullable, not optional. A legacy Order
 * missing the attribute entirely fails that validation immediately
 * (confirmed live: Nyc311OrderScheduling-Test has been throwing exactly
 * this ValidationError on every scheduled run since the schema change
 * deployed, since listOrdersWaitingForSchedule hits the same gate). This
 * script performs the identical DynamoDB transaction rejectOrder() would
 * (same event shape, same projection fold, same dropped GSI keys) but
 * skips that now-too-strict re-validation, since re-validating is exactly
 * what these rows can't survive.
 *
 * This also happens to be the fix for that live crash: rejectOrder()'s
 * projection Put never carries gsi1pk/gsi1sk forward (they're storage-only
 * additions, not part of Order's own schema, and rejectOrder passes no
 * additionalProjectionAttributes), so a rejected Order drops out of
 * gsi1-stage-sla — which is exactly what Nyc311OrderScheduling-Test's
 * listOrdersWaitingForSchedule queries. Once these rows are rejected, that
 * query stops returning them and stops crashing on them.
 *
 * Requires: AWS CLI v2 credentials under a "nyc311" profile (this script
 * uses the AWS SDK for JS directly, not the CLI, for scan/transact-write
 * throughput reasons — a ~1.15M-item table scan and a few hundred
 * thousand TransactWriteItems calls are impractical one aws-cli
 * subprocess at a time) with dynamodb:Scan/TransactWriteItems against
 * Orders-Test (or Orders-Prod with --env prod).
 *
 * Usage:
 *   npm install                              # first run only, installs @aws-sdk/* here
 *   node 10-reject-non-street-condition-orders.js                  # dry run against Test
 *   node 10-reject-non-street-condition-orders.js --execute         # real run against Test
 *   node 10-reject-non-street-condition-orders.js --execute --limit 25   # small first batch
 *   node 10-reject-non-street-condition-orders.js --execute --env prod   # targets Orders-Prod
 */

const { parseArgs } = require("node:util");
const {
  DynamoDBClient,
} = require("@aws-sdk/client-dynamodb");
const {
  DynamoDBDocumentClient,
  ScanCommand,
  TransactWriteCommand,
} = require("@aws-sdk/lib-dynamodb");

const AWS_PROFILE = "nyc311";
const PROJECTION_SORT_KEY = "#METADATA";
const STREET_CONDITION = "Street Condition";
const DEFAULT_REASON =
  'Bulk reject: complaint_type is not "Street Condition" (11-street-condition-implementation.md §1)';

/* Exactly Order's own schema fields (backend/models/order.ts) — deliberately excludes
 * gsi1pk/gsi1sk/gsi2pk/gsi2sk so a rejected Order drops out of both GSIs, matching
 * OrderDao.rejectOrder()'s real behavior (see header comment). */
const ORDER_PROJECTION_FIELDS = [
  "order_id",
  "request_id",
  "location_id",
  "complaint_type",
  "current_stage",
  "status",
  "retry_counts",
  "priority_tier",
  "sla_deadline",
  "scheduled_start",
  "scheduled_end",
  "assigned_operator_id",
  "reassignment_count",
  "case_id",
  "created_at",
  "updated_at",
  "last_event_sequence",
];

function parseCliArgs() {
  const { values } = parseArgs({
    options: {
      env: { type: "string", default: "test" },
      execute: { type: "boolean", default: false },
      limit: { type: "string" },
      concurrency: { type: "string", default: "20" },
      reason: { type: "string", default: DEFAULT_REASON },
    },
  });
  if (values.env !== "test" && values.env !== "prod") {
    throw new Error(`--env must be "test" or "prod", got "${values.env}"`);
  }
  return {
    env: values.env,
    execute: values.execute,
    limit: values.limit ? Number.parseInt(values.limit, 10) : null,
    concurrency: Number.parseInt(values.concurrency, 10),
    reason: values.reason,
  };
}

function isTargetOrder(item) {
  if (item.status === "REJECTED") return false;
  const complaintType = item.complaint_type;
  return complaintType === undefined || complaintType === null || complaintType !== STREET_CONDITION;
}

async function scanTargetOrders(docClient, tableName, onProgress) {
  const candidates = [];
  let scanned = 0;
  let examined = 0;
  let alreadyRejected = 0;
  let missingComplaintType = 0;
  let mismatchedComplaintType = 0;
  let exclusiveStartKey;

  do {
    const page = await docClient.send(
      new ScanCommand({
        TableName: tableName,
        FilterExpression: "sk = :meta",
        ExpressionAttributeValues: { ":meta": PROJECTION_SORT_KEY },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    scanned += page.ScannedCount ?? 0;
    for (const item of page.Items ?? []) {
      examined += 1;
      if (item.status === "REJECTED") {
        alreadyRejected += 1;
        continue;
      }
      if (isTargetOrder(item)) {
        if (item.complaint_type === undefined || item.complaint_type === null) {
          missingComplaintType += 1;
        } else {
          mismatchedComplaintType += 1;
        }
        candidates.push(item);
      }
    }
    exclusiveStartKey = page.LastEvaluatedKey;
    onProgress({ scanned, examined, candidates: candidates.length });
  } while (exclusiveStartKey);

  return { candidates, scanned, examined, alreadyRejected, missingComplaintType, mismatchedComplaintType };
}

/** Same event/projection shape as OrderDao.rejectOrder (backend/dao/order/orderDao.ts), same
 * TransactWriteItems condition checks as EventSourcedDao.appendEvent (backend/dao/dao.ts) —
 * just without re-validating the previous projection against OrderSchema first. */
async function rejectOrderRaw(docClient, tableName, item, reason) {
  const now = new Date().toISOString();
  const nextSequence = item.last_event_sequence + 1;

  const eventItem = {
    order_id: item.order_id,
    sk: `EVENT#${nextSequence}`,
    event_type: "ORDER_REJECTED",
    stage: null,
    payload: { reason },
    occurred_at: now,
    actor: "SYSTEM",
    sequence_number: nextSequence,
  };

  const newProjection = { sk: PROJECTION_SORT_KEY };
  for (const field of ORDER_PROJECTION_FIELDS) {
    if (field in item) newProjection[field] = item[field];
  }
  newProjection.status = "REJECTED";
  newProjection.updated_at = now;
  newProjection.last_event_sequence = nextSequence;

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Put: {
            TableName: tableName,
            Item: eventItem,
            ConditionExpression: "attribute_not_exists(sk)",
          },
        },
        {
          Put: {
            TableName: tableName,
            Item: newProjection,
            ConditionExpression: "last_event_sequence = :previousSequence",
            ExpressionAttributeValues: { ":previousSequence": item.last_event_sequence },
          },
        },
      ],
    })
  );
}

async function withRetries(fn, { attempts = 5, baseDelayMs = 200 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      const retryable =
        err?.name === "ProvisionedThroughputExceededException" ||
        err?.name === "ThrottlingException" ||
        err?.$retryable;
      if (!retryable || attempt === attempts) throw err;
      const delay = baseDelayMs * 2 ** (attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw new Error("unreachable");
}

async function runPool(items, concurrency, worker) {
  let nextIndex = 0;
  async function runNext() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, runNext));
}

async function main() {
  const args = parseCliArgs();
  const envSuffix = args.env === "prod" ? "Prod" : "Test";
  const tableName = `Orders-${envSuffix}`;

  process.env.AWS_PROFILE = AWS_PROFILE;
  process.env.AWS_SDK_LOAD_CONFIG = "1";

  console.log(`Table: ${tableName}  Mode: ${args.execute ? "EXECUTE (real writes)" : "DRY RUN"}  Reason: "${args.reason}"`);
  if (args.limit !== null) console.log(`Limit: stopping after ${args.limit} rejects`);
  if (args.env === "prod") {
    console.log("!! Targeting Orders-Prod. Per 11-street-condition-implementation.md §1 this should have zero rows today — double-check before proceeding.");
  }

  const client = new DynamoDBClient({});
  const docClient = DynamoDBDocumentClient.from(client, {
    marshallOptions: { removeUndefinedValues: true },
  });

  console.log("\nScanning for target Orders (this is a full-table scan — may take several minutes)...");
  const startedAt = Date.now();
  const { candidates, scanned, examined, alreadyRejected, missingComplaintType, mismatchedComplaintType } =
    await scanTargetOrders(docClient, tableName, ({ scanned: s, examined: e, candidates: c }) => {
      if (s % 50000 < 2000) {
        console.log(`  ...scanned ${s} items, examined ${e} Orders, ${c} candidates so far`);
      }
    });
  const scanElapsedSec = ((Date.now() - startedAt) / 1000).toFixed(1);

  console.log(`\nScan complete in ${scanElapsedSec}s:`);
  console.log(`  Items scanned (Orders + Events): ${scanned}`);
  console.log(`  Orders examined (#METADATA rows): ${examined}`);
  console.log(`  Already REJECTED (skipped):       ${alreadyRejected}`);
  console.log(`  Missing complaint_type (legacy):  ${missingComplaintType}`);
  console.log(`  complaint_type != "Street Condition": ${mismatchedComplaintType}`);
  console.log(`  Total candidates to reject:        ${candidates.length}`);

  const toProcess = args.limit !== null ? candidates.slice(0, args.limit) : candidates;
  if (args.limit !== null && toProcess.length < candidates.length) {
    console.log(`  --limit ${args.limit} applied: processing ${toProcess.length} of ${candidates.length}`);
  }

  if (!args.execute) {
    console.log("\nDry run — no writes performed. Re-run with --execute to actually reject these Orders.");
    return;
  }

  console.log(`\nRejecting ${toProcess.length} Orders (concurrency ${args.concurrency})...`);
  let succeeded = 0;
  let failed = 0;
  const failures = [];
  let processed = 0;

  await runPool(toProcess, args.concurrency, async (item) => {
    try {
      await withRetries(() => rejectOrderRaw(docClient, tableName, item, args.reason));
      succeeded += 1;
    } catch (err) {
      failed += 1;
      failures.push({ order_id: item.order_id, error: err?.message ?? String(err) });
      console.error(`  FAILED order_id=${item.order_id}: ${err?.message ?? err}`);
    }
    processed += 1;
    if (processed % 500 === 0) {
      console.log(`  ...processed ${processed}/${toProcess.length} (succeeded ${succeeded}, failed ${failed})`);
    }
  });

  console.log(`\nDone. Succeeded: ${succeeded}  Failed: ${failed}`);
  if (failures.length > 0) {
    console.log("Failures:");
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.order_id}: ${f.error}`);
    }
    if (failures.length > 20) console.log(`  ...and ${failures.length - 20} more`);
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exitCode = 1;
});
