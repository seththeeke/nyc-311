import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CustomerIdeaWorkerLambda } from "../../customer/CustomerIdeaWorkerLambda";
import { CustomerResidentSchedules } from "../../customer/CustomerResidentSchedules";
import { CustomerResidentSync } from "../../customer/CustomerResidentSync";
import { CustomerResidentSyncLambda } from "../../customer/CustomerResidentSyncLambda";
import { CUSTOMER_RESIDENT_SEEDS_DIR, CUSTOMER_RESIDENT_SYNC_INPUTS } from "../../customer/customerBackendRoot";
import { loadResidentSeeds, residentSyncHash } from "../../customer/residentSeedFiles";
import { ResidentIdeasTable } from "../../customer/ResidentIdeasTable";
import { ResidentsTable } from "../../customer/ResidentsTable";
import { WebhookCustomerFacingOrdersTable } from "../../customer/WebhookCustomerFacingOrdersTable";

describe("resident seed files", () => {
  it("summarises every committed seed: one schedule and one model each", () => {
    const seeds = loadResidentSeeds();
    expect(seeds.map((seed) => seed.personaId)).toEqual(["hawthorn", "juniper", "sycamore"]);
    /* Every 3 hours each, offset an hour apart, so one resident thinks every hour. */
    expect(seeds.map((seed) => seed.schedule)).toEqual(["cron(0 0/3 * * ? *)", "cron(0 1/3 * * ? *)", "cron(0 2/3 * * ? *)"]);
    for (const seed of seeds) expect(seed.modelId).toBe("amazon.nova-micro-v1:0");
    expect(CUSTOMER_RESIDENT_SYNC_INPUTS[0]).toBe(CUSTOMER_RESIDENT_SEEDS_DIR);
  });

  it("refuses a seed missing a field the stack needs", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "seeds-"));
    fs.writeFileSync(path.join(dir, "oak.json"), JSON.stringify({ persona_id: "oak", schedule: "cron(0 9 * * ? *)" }));
    fs.writeFileSync(path.join(dir, "README.md"), "not a seed");
    expect(() => loadResidentSeeds(dir)).toThrow("Resident seed oak.json has no model_id");
  });

  it("hashes the sync's inputs, nested files included, and changes when one does", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sync-"));
    fs.mkdirSync(path.join(dir, "nested"));
    fs.writeFileSync(path.join(dir, "nested", "a.json"), "1");
    const before = residentSyncHash([dir]);
    expect(residentSyncHash([dir])).toBe(before);
    fs.writeFileSync(path.join(dir, "nested", "a.json"), "2");
    expect(residentSyncHash([dir])).not.toBe(before);
    expect(residentSyncHash()).toMatch(/^[0-9a-f]{64}$/);
  });
});

function synthesize(seedHash?: string): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  const residentsTable = new ResidentsTable(stack, "ResidentsTable");
  const syncLambda = new CustomerResidentSyncLambda(stack, "Sync", { residentsTable });
  new CustomerResidentSync(stack, "CustomerResidentSync", { syncLambda, seedHash });
  const ideaWorker = new CustomerIdeaWorkerLambda(stack, "Worker", {
    residentsTable,
    ideasTable: new ResidentIdeasTable(stack, "ResidentIdeasTable"),
    ordersTable: new WebhookCustomerFacingOrdersTable(stack, "Orders"),
    modelIds: ["amazon.nova-micro-v1:0"],
  });
  new CustomerResidentSchedules(stack, "Schedules", {
    ideaWorker,
    residents: [
      { personaId: "hawthorn", schedule: "cron(0 10,18 * * ? *)", modelId: "amazon.nova-micro-v1:0" },
      { personaId: "oak", schedule: "cron(*/30 * * * ? *)", modelId: "amazon.nova-micro-v1:0" },
    ],
  });
  return Template.fromStack(stack);
}

describe("CustomerResidentSync", () => {
  it("runs the sync Lambda as a custom resource keyed on the seed hash, through a named provider", () => {
    const template = synthesize("abc123");
    template.hasResourceProperties("Custom::ResidentSeedSync", { SeedHash: "abc123" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "CustomerResidentSyncProvider-Prod" });
    template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/CustomerResidentSyncProvider-Prod", RetentionInDays: 30 });
  });

  it("defaults the hash to the real seeds and sync code", () => {
    synthesize().hasResourceProperties("Custom::ResidentSeedSync", { SeedHash: residentSyncHash() });
  });
});

describe("CustomerResidentSchedules", () => {
  it("gives each resident its own cron in New York time, spread by a flexible window, with retries", () => {
    const template = synthesize("x");
    template.resourceCountIs("AWS::Scheduler::Schedule", 2);
    template.hasResourceProperties("AWS::Scheduler::Schedule", {
      Name: "CustomerResident-hawthorn-Prod",
      ScheduleExpression: "cron(0 10,18 * * ? *)",
      ScheduleExpressionTimezone: "America/New_York",
      FlexibleTimeWindow: { Mode: "FLEXIBLE", MaximumWindowInMinutes: 15 },
      State: "ENABLED",
      Target: { Input: JSON.stringify({ persona_id: "hawthorn" }), RetryPolicy: { MaximumRetryAttempts: 2, MaximumEventAgeInSeconds: 3600 } },
    });
    template.hasResourceProperties("AWS::Scheduler::Schedule", { Name: "CustomerResident-oak-Prod", ScheduleExpression: "cron(*/30 * * * ? *)" });
  });

  it("invokes through its own scheduler role", () => {
    synthesize("x").hasResourceProperties("AWS::IAM::Role", {
      RoleName: "CustomerResidentScheduler-Prod",
      AssumeRolePolicyDocument: { Statement: [{ Action: "sts:AssumeRole", Principal: { Service: "scheduler.amazonaws.com" } }] },
    });
  });
});
