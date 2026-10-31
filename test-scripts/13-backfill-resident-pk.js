#!/usr/bin/env node
/**
 * Backfills `resident_pk` (docs/16-resident-action-models.md §5.3) onto
 * idea rows written before the idea worker started setting it, so the
 * sparse ByResident index lists every resident's ideas. Only `IDEA#<ulid>`
 * rows are touched: thread rows and step rows never carry it.
 *
 * Safe to run twice: each update is conditioned on the row still having
 * no `resident_pk`.
 *
 * NOT read-only, but defaults to a dry run that only counts; pass
 * --execute to write. --execute writes to a real DynamoDB table, so it
 * falls under CLAUDE.md §3's Deploy Safety Gate — confirm before every run.
 * Run it after the ByResident index exists (C1 deployed), before C2 ships.
 *
 * Requires: AWS credentials under a "nyc311" profile with dynamodb:Scan
 * and dynamodb:UpdateItem on ResidentIdeas-Prod.
 *
 * Usage:
 *   npm install                              # first run only
 *   node 13-backfill-resident-pk.js          # dry run
 *   node 13-backfill-resident-pk.js --execute
 */

const { parseArgs } = require("node:util");
const { ConditionalCheckFailedException, DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");

const AWS_PROFILE = "nyc311";
const REGION = "us-east-1";
/* The customer exists only in Prod (13-customer-simulation.md §6). */
const TABLE_NAME = "ResidentIdeas-Prod";
/* An idea row's key is exactly IDEA#<ulid>; step rows (IDEA#<ulid>#STEP#n) must never be indexed. */
const IDEA_ROW_SK = /^IDEA#[0-9A-HJKMNP-TV-Z]{26}$/;

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
        FilterExpression: "begins_with(sk, :idea) AND attribute_not_exists(resident_pk)",
        ExpressionAttributeValues: { ":idea": "IDEA#" },
        ProjectionExpression: "persona_id, sk",
        ExclusiveStartKey: startKey,
      })
    );
    candidates.push(...(page.Items ?? []).filter((row) => IDEA_ROW_SK.test(row.sk)));
    startKey = page.LastEvaluatedKey;
  } while (startKey);

  const byResident = {};
  for (const row of candidates) byResident[row.persona_id] = (byResident[row.persona_id] ?? 0) + 1;
  console.log(`${candidates.length} idea(s) without resident_pk in ${TABLE_NAME}:`, byResident);
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
          Key: { persona_id: row.persona_id, sk: row.sk },
          UpdateExpression: "SET resident_pk = :persona",
          ConditionExpression: "attribute_exists(sk) AND attribute_not_exists(resident_pk)",
          ExpressionAttributeValues: { ":persona": row.persona_id },
        })
      );
      updated++;
    } catch (err) {
      if (!(err instanceof ConditionalCheckFailedException)) throw err;
      skipped++;
    }
  }
  console.log(`Backfilled ${updated}; skipped ${skipped} already keyed since the scan.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
