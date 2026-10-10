#!/usr/bin/env node
/**
 * Replays webhook events (13-customer-simulation.md §5, operability
 * decision): for each given Order, puts its stored ORDER_ACCEPTED and/or
 * ORDER_RESOLVED event back on the webhook dispatch queue, exactly as the
 * order-events topic first delivered it. The dispatch Lambda then rebuilds
 * the public payload and sends it to every ACTIVE subscription.
 *
 * Safe to run twice: the `webhook-id` (`evt_<order_id>_<sequence_number>`)
 * is unchanged, so a receiver that already has the event ignores it and
 * one that lost it stores it.
 *
 * NOT read-only, but defaults to --dry-run reporting only; pass --execute
 * to actually send. --execute writes to a real SQS queue, so it falls
 * under CLAUDE.md §3's Deploy Safety Gate — confirm before every run.
 *
 * To replay a time window, first list the order ids from the warehouse
 * (the admin SQL console can select Orders accepted in a range), then
 * pass them here.
 *
 * Requires: AWS credentials under a "nyc311" profile with dynamodb:Query
 * on Orders-<Env> and sqs:GetQueueUrl/SendMessage on
 * Nyc311WebhookDispatchQueue-<Env>.
 *
 * Usage:
 *   npm install                                                  # first run only
 *   node 11-replay-webhook-events.js 01K74PZ3... 01K74Q11...     # dry run against Test
 *   node 11-replay-webhook-events.js --execute 01K74PZ3...       # real run against Test
 *   node 11-replay-webhook-events.js --execute --env prod 01K74PZ3...
 *   node 11-replay-webhook-events.js --type ORDER_RESOLVED 01K74PZ3...   # one event type only
 */

const { parseArgs } = require("node:util");
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { GetQueueUrlCommand, SendMessageCommand, SQSClient } = require("@aws-sdk/client-sqs");

const AWS_PROFILE = "nyc311";
/* The public webhook catalogue's source events — mirrors backend/models/webhookSubscription.ts. */
const REPLAYABLE_EVENT_TYPES = ["ORDER_ACCEPTED", "ORDER_RESOLVED"];
const ENV_SUFFIX = { test: "Test", prod: "Prod" };
/* Exactly OrderEvent's own schema fields (backend/models/order.ts) — the stored item also carries `sk`. */
const ORDER_EVENT_FIELDS = ["order_id", "sequence_number", "event_type", "stage", "payload", "occurred_at", "actor"];

function parseCliArgs() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      env: { type: "string", default: "test" },
      execute: { type: "boolean", default: false },
      type: { type: "string" },
    },
  });
  if (!(values.env in ENV_SUFFIX)) {
    throw new Error(`--env must be "test" or "prod", got "${values.env}"`);
  }
  if (values.type !== undefined && !REPLAYABLE_EVENT_TYPES.includes(values.type)) {
    throw new Error(`--type must be one of ${REPLAYABLE_EVENT_TYPES.join(", ")}, got "${values.type}"`);
  }
  if (positionals.length === 0) {
    throw new Error("Pass at least one order id");
  }
  return {
    env: values.env,
    execute: values.execute,
    eventTypes: values.type ? [values.type] : REPLAYABLE_EVENT_TYPES,
    orderIds: [...new Set(positionals)],
  };
}

async function listReplayableEvents(documentClient, tableName, orderId, eventTypes) {
  const events = [];
  let exclusiveStartKey;
  do {
    const result = await documentClient.send(
      new QueryCommand({
        TableName: tableName,
        KeyConditionExpression: "order_id = :orderId AND begins_with(sk, :eventPrefix)",
        ExpressionAttributeValues: { ":orderId": orderId, ":eventPrefix": "EVENT#" },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );
    for (const item of result.Items ?? []) {
      if (eventTypes.includes(item.event_type)) {
        events.push(Object.fromEntries(ORDER_EVENT_FIELDS.map((field) => [field, item[field]])));
      }
    }
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return events.sort((a, b) => a.sequence_number - b.sequence_number);
}

async function main() {
  const args = parseCliArgs();
  process.env.AWS_PROFILE = AWS_PROFILE;
  const suffix = ENV_SUFFIX[args.env];
  const tableName = `Orders-${suffix}`;
  const queueName = `Nyc311WebhookDispatchQueue-${suffix}`;

  const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
  const sqsClient = new SQSClient({});
  console.log(`${args.execute ? "EXECUTE" : "DRY RUN"}: ${args.orderIds.length} order(s), ${args.eventTypes.join(" + ")}, ${tableName} -> ${queueName}`);

  const queueUrl = args.execute ? (await sqsClient.send(new GetQueueUrlCommand({ QueueName: queueName }))).QueueUrl : null;

  let sent = 0;
  let ordersWithNothing = 0;
  for (const orderId of args.orderIds) {
    const events = await listReplayableEvents(documentClient, tableName, orderId, args.eventTypes);
    if (events.length === 0) {
      ordersWithNothing += 1;
      console.log(`  ${orderId}: no ${args.eventTypes.join("/")} event found — skipped`);
      continue;
    }
    for (const event of events) {
      const webhookId = `evt_${event.order_id}_${event.sequence_number}`;
      if (args.execute) {
        await sqsClient.send(new SendMessageCommand({ QueueUrl: queueUrl, MessageBody: JSON.stringify(event) }));
      }
      sent += 1;
      console.log(`  ${orderId}: ${event.event_type} (${webhookId}, ${event.occurred_at}) ${args.execute ? "sent" : "would send"}`);
    }
  }

  console.log(`${args.execute ? "Sent" : "Would send"} ${sent} event(s); ${ordersWithNothing} order(s) had nothing to replay.`);
  if (!args.execute) console.log("Dry run only — pass --execute to send.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
