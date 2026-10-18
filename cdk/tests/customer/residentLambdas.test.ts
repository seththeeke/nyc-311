import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CustomerIdeaWorkerLambda } from "../../customer/CustomerIdeaWorkerLambda";
import { CustomerReadApiLambda } from "../../customer/CustomerReadApiLambda";
import { CustomerResidentSyncLambda } from "../../customer/CustomerResidentSyncLambda";
import { ResidentIdeasTable } from "../../customer/ResidentIdeasTable";
import { ResidentsTable } from "../../customer/ResidentsTable";
import { WebhookCustomerFacingOrdersTable } from "../../customer/WebhookCustomerFacingOrdersTable";
import { actionsOf, statements } from "./customerTestSupport";

function synthesize(build: (stack: Stack, tables: { residentsTable: ResidentsTable; ideasTable: ResidentIdeasTable; ordersTable: WebhookCustomerFacingOrdersTable }) => void): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  build(stack, {
    residentsTable: new ResidentsTable(stack, "ResidentsTable"),
    ideasTable: new ResidentIdeasTable(stack, "ResidentIdeasTable"),
    ordersTable: new WebhookCustomerFacingOrdersTable(stack, "WebhookCustomerFacingOrdersTable"),
  });
  return Template.fromStack(stack);
}

/* "action on TableName" for every grant, sorted, so a test reads like the policy. */
function grants(template: Template): string[] {
  return statements(template)
    .flatMap((statement) => {
      const resource = JSON.stringify(statement.Resource);
      const table = /"(WebhookCustomerFacingOrdersTable|ResidentsTable|ResidentIdeasTable)[0-9A-F]{8}"/.exec(resource)?.[1] ?? resource;
      return actionsOf(statement).map((action) => `${action} ${table}`);
    })
    .sort();
}

describe("CustomerResidentSyncLambda", () => {
  const template = synthesize((stack, t) => new CustomerResidentSyncLambda(stack, "Sync", { residentsTable: t.residentsTable }));

  it("runs the sync controller with the residents table's name and a disposable log group", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "CustomerResidentSync-Prod",
      Handler: "index.syncResidentsController",
      Runtime: "nodejs22.x",
      Environment: { Variables: { RESIDENTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^ResidentsTable") } } },
    });
    template.hasResourceProperties("AWS::Logs::LogGroup", { LogGroupName: "/aws/lambda/CustomerResidentSync-Prod", RetentionInDays: 30 });
  });

  it("may only read and write residents", () => {
    expect(grants(template)).toEqual(["dynamodb:GetItem ResidentsTable", "dynamodb:PutItem ResidentsTable", "dynamodb:UpdateItem ResidentsTable"]);
  });
});

describe("CustomerIdeaWorkerLambda", () => {
  const template = synthesize(
    (stack, t) => new CustomerIdeaWorkerLambda(stack, "Worker", { ...t, modelIds: ["amazon.nova-micro-v1:0", "amazon.nova-micro-v1:0", "amazon.nova-lite-v1:0"] })
  );

  it("runs the idea controller with all three tables' names and a minute to think", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "CustomerIdeaWorker-Prod",
      Handler: "index.generateIdeaController",
      Timeout: 60,
      Environment: {
        Variables: {
          RESIDENTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^ResidentsTable") },
          RESIDENT_IDEAS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^ResidentIdeasTable") },
          CUSTOMER_ORDERS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^WebhookCustomerFacingOrdersTable") },
        },
      },
    });
  });

  it("reads orders, writes ideas and counters, and may call each configured model once", () => {
    const granted = grants(template);
    expect(granted.filter((grant) => grant.startsWith("dynamodb:"))).toEqual([
      "dynamodb:BatchGetItem WebhookCustomerFacingOrdersTable",
      "dynamodb:GetItem ResidentsTable",
      "dynamodb:PutItem ResidentIdeasTable",
      "dynamodb:Query ResidentIdeasTable",
      "dynamodb:Query WebhookCustomerFacingOrdersTable",
      "dynamodb:UpdateItem ResidentIdeasTable",
      "dynamodb:UpdateItem ResidentsTable",
    ]);
    const bedrock = statements(template).find((statement) => actionsOf(statement).includes("bedrock:InvokeModel"));
    expect(bedrock?.Resource).toEqual([
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-lite-v1:0",
      "arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0",
    ]);
  });
});

describe("CustomerReadApiLambda", () => {
  const template = synthesize((stack, t) => new CustomerReadApiLambda(stack, "Read", t));

  it("runs the read controller", () => {
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "CustomerReadApi-Prod", Handler: "index.residentApiController", Timeout: 10 });
  });

  it("is read-only on every table", () => {
    expect(grants(template)).toEqual([
      "dynamodb:BatchGetItem WebhookCustomerFacingOrdersTable",
      "dynamodb:GetItem ResidentIdeasTable",
      "dynamodb:GetItem ResidentsTable",
      "dynamodb:Query ResidentIdeasTable",
      "dynamodb:Query ResidentsTable",
    ]);
  });
});
