#!/usr/bin/env node
/**
 * Backfills the OpenByBorough sampling keys (13-customer-simulation.md §2
 * customer side, decision 5) onto customer order rows that were opened
 * before the listener started writing them: every OPEN row in
 * WebhookCustomerFacingOrders-Prod with a borough and no `pick_key` gets
 * `open_borough` (its borough) and a random `pick_key`, so the idea
 * worker can sample it.
 *
 * Safe to run twice: each update is conditioned on the row still being
 * OPEN with no `pick_key`, so a row closed meanwhile, or already keyed,
 * is left alone.
 *
 * NOT read-only, but defaults to a dry run that only counts; pass
 * --execute to write. --execute writes to a real DynamoDB table, so it
 * falls under CLAUDE.md §3's Deploy Safety Gate — confirm before every run.
 *
 * Requires: AWS credentials under a "nyc311" profile with dynamodb:Scan
 * and dynamodb:UpdateItem on WebhookCustomerFacingOrders-Prod.
 *
 * Usage:
 *   npm install                                      # first run only
 *   node 12-backfill-open-order-pick-keys.js         # dry run
 *   node 12-backfill-open-order-pick-keys.js --execute
 */

const { randomBytes } = require("node:crypto");
const { parseArgs } = require("node:util");
const { ConditionalCheckFailedException, DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const AWS_PROFILE = "nyc311";
const REGION = "us-east-1";
/* The customer exists only in Prod (13-customer-simulation.md §6). */
const TABLE_NAME = "WebhookCustomerFacingOrders-Prod";

async function main() {
  const { values } = parseArgs({ options: { execute: { type: "boolean", default: false } } });
  process.env.AWS_PROFILE = AWS_PROFILE;
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({ region: REGION }));

  const candidates = [];
  let startKey;
  do {
    const page = await client.send(
      new ScanCommand({
        TableName: TABLE_NAME,
        FilterExpression: "#status = :open AND attribute_exists(borough) AND borough <> :null AND attribute_not_exists(pick_key)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":open": "OPEN", ":null": null },
        ProjectionExpression: "order_id, borough",
        ExclusiveStartKey: startKey,
      })
    );
    candidates.push(...(page.Items ?? []));
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  const byBorough = {};
  for (const row of candidates) byBorough[row.borough] = (byBorough[row.borough] ?? 0) + 1;
  console.log(`${candidates.length} open order(s) without sampling keys in ${TABLE_NAME}:`, byBorough);
  if (!values.execute) {
    console.log("Dry run — nothing written. Pass --execute to backfill.");
    return;
  }

  let updated = 0;
  let skipped = 0;
  for (const row of candidates) {
    try {
      await client.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { order_id: row.order_id },
          UpdateExpression: "SET open_borough = :borough, pick_key = :pick",
          ConditionExpression: "#status = :open AND attribute_not_exists(pick_key)",
          ExpressionAttributeNames: { "#status": "status" },
          ExpressionAttributeValues: { ":borough": row.borough, ":pick": randomBytes(8).toString("hex"), ":open": "OPEN" },
        })
      );
      updated++;
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      skipped++;
    }
  }
  console.log(`Backfilled ${updated}; skipped ${skipped} closed or already keyed since the scan.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
