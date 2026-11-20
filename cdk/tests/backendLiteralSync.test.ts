import { readFileSync } from "node:fs";
import * as path from "node:path";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { describe, expect, it } from "vitest";
import { LocationsTable } from "../data/LocationsTable";
import { OrdersTable } from "../data/OrdersTable";
import { RequestsTable } from "../data/RequestsTable";
import { LIVE_WORKSPACE_METRICS_EVENT_TYPES } from "../lambda/Nyc311LiveWorkspaceMetricsQueue";
import { ORDER_EVALUATION_EVENT_TYPES } from "../lambda/Nyc311OrderEvaluationQueue";
import { ORDER_INGESTION_EVENT_NAMES } from "../lambda/Nyc311OrderIngestionQueue";
import { WEBHOOK_SOURCE_EVENT_TYPES } from "../lambda/Nyc311WebhookDispatchQueue";
import { Nyc311WarehouseRebuildStateMachine } from "../step-function/Nyc311WarehouseRebuildStateMachine";
import { Nyc311WarehouseBucket } from "../warehouse/Nyc311WarehouseBucket";

/*
 * #219 — cdk hand-types backend strings in SNS filter policies and the
 * rebuild state machine's payloads. A backend rename would leave a queue
 * silently empty with every other test green. This checks each value
 * against backend's model source. Reads the source as text, like
 * warehouse/schemaSync.test.ts, because cdk has no `zod` dependency.
 */

const BACKEND_MODELS = path.join(__dirname, "..", "..", "backend", "models");

function readModel(file: string): string {
  return readFileSync(path.join(BACKEND_MODELS, file), "utf8");
}

/* Every `"..."` string inside the first match of `pattern`; throws if the pattern is gone, so a restructure fails loudly. */
function quotedStringsIn(source: string, pattern: RegExp, what: string): string[] {
  const match = pattern.exec(source);
  if (!match) throw new Error(`Could not find ${what} in backend source — update backendLiteralSync.test.ts`);
  return [...match[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
}

const ORDER_EVENT_TYPES = quotedStringsIn(
  readModel("order.ts"),
  /export const ORDER_EVENT_TYPES = \[([\s\S]*?)\] as const/,
  "ORDER_EVENT_TYPES in order.ts"
);
const REQUEST_STREAM_EVENT_NAMES = quotedStringsIn(
  readModel("requestStreamEvent.ts"),
  /eventName: z\.enum\(\[([^\]]*)\]\)/,
  "RequestStreamRecordSchema.eventName in requestStreamEvent.ts"
);
const warehouseRebuildSource = readModel("warehouseRebuild.ts");
const REBUILD_SOURCES = quotedStringsIn(
  warehouseRebuildSource,
  /export const REBUILD_SOURCES = \[([^\]]*)\] as const/,
  "REBUILD_SOURCES in warehouseRebuild.ts"
);
const REBUILD_PHASES = [...warehouseRebuildSource.matchAll(/phase: z\.literal\("([^"]+)"\)/g)].map((m) => m[1]);

/* The rebuild state machine's flattened definition text — same flattening as its own construct test. */
function rebuildDefinition(): string {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const fn = (id: string) =>
    new lambda.Function(stack, id, {
      runtime: lambda.Runtime.NODEJS_22_X,
      handler: "index.handler",
      code: lambda.Code.fromInline("exports.handler = async () => {};"),
    });
  new Nyc311WarehouseRebuildStateMachine(stack, "Nyc311WarehouseRebuildStateMachine", {
    envName: "TEST",
    warehouseBucket: new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName: "TEST" }),
    ordersTable: new OrdersTable(stack, "OrdersTable", { envName: "TEST" }),
    requestsTable: new RequestsTable(stack, "RequestsTable", { envName: "TEST" }),
    locationsTable: new LocationsTable(stack, "LocationsTable", { envName: "TEST" }),
    rebuildLambda: fn("RebuildLambda"),
    jobRunnerLambda: fn("JobRunnerLambda"),
  });
  const sm = Object.values(Template.fromStack(stack).findResources("AWS::StepFunctions::StateMachine"))[0] as {
    Properties: { DefinitionString: { "Fn::Join": [string, unknown[]] } };
  };
  return sm.Properties.DefinitionString["Fn::Join"][1].map((part) => (typeof part === "string" ? part : "")).join("");
}

const definition = rebuildDefinition();
const uniqueMatches = (pattern: RegExp): string[] => [...new Set([...definition.matchAll(pattern)].map((m) => m[1]))];
const CDK_REBUILD_PHASES = uniqueMatches(/"phase":"([^"]+)"/g);
const CDK_REBUILD_SOURCES = uniqueMatches(/"source":"([^"]+)"/g);

describe("cdk ↔ backend literal sync (#219)", () => {
  it("extracts a non-empty value list from every backend model", () => {
    for (const list of [ORDER_EVENT_TYPES, REQUEST_STREAM_EVENT_NAMES, REBUILD_SOURCES, REBUILD_PHASES]) {
      expect(list.length).toBeGreaterThan(0);
    }
  });

  const orderEventFilters: [string, string[]][] = [
    ["Nyc311OrderEvaluationQueue", ORDER_EVALUATION_EVENT_TYPES],
    ["Nyc311LiveWorkspaceMetricsQueue", LIVE_WORKSPACE_METRICS_EVENT_TYPES],
    ["Nyc311WebhookDispatchQueue", WEBHOOK_SOURCE_EVENT_TYPES],
  ];
  for (const [construct, allowlist] of orderEventFilters) {
    for (const eventType of allowlist) {
      it(`${construct}: filter event_type "${eventType}" is a backend ORDER_EVENT_TYPES value`, () => {
        expect(ORDER_EVENT_TYPES).toContain(eventType);
      });
    }
  }

  for (const eventName of ORDER_INGESTION_EVENT_NAMES) {
    it(`Nyc311OrderIngestionQueue: filter event_name "${eventName}" is a backend request stream eventName`, () => {
      expect(REQUEST_STREAM_EVENT_NAMES).toContain(eventName);
    });
  }

  it("the rebuild state machine sends at least one phase and one source", () => {
    expect(CDK_REBUILD_PHASES.length).toBeGreaterThan(0);
    expect(CDK_REBUILD_SOURCES.length).toBeGreaterThan(0);
  });

  for (const phase of CDK_REBUILD_PHASES) {
    it(`Nyc311WarehouseRebuildStateMachine: phase "${phase}" is a backend rebuild task phase`, () => {
      expect(REBUILD_PHASES).toContain(phase);
    });
  }
  for (const source of CDK_REBUILD_SOURCES) {
    it(`Nyc311WarehouseRebuildStateMachine: source "${source}" is a backend REBUILD_SOURCES value`, () => {
      expect(REBUILD_SOURCES).toContain(source);
    });
  }

  it("Nyc311WarehouseRebuildStateMachine: invokes every backend phase and rebuilds every backend source", () => {
    expect([...CDK_REBUILD_PHASES].sort()).toEqual([...REBUILD_PHASES].sort());
    expect([...CDK_REBUILD_SOURCES].sort()).toEqual([...REBUILD_SOURCES].sort());
  });
});
