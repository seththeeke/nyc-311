import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { ACTION_WORKER_MAX_CONCURRENCY, CustomerActionWorkerLambda } from "../../customer/CustomerActionWorkerLambda";
import { CustomerIdeaWorkerLambda } from "../../customer/CustomerIdeaWorkerLambda";
import { IdeaActionsQueue } from "../../customer/IdeaActionsQueue";
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
    (stack, t) =>
      new CustomerIdeaWorkerLambda(stack, "Worker", {
        ...t,
        modelIds: ["amazon.nova-micro-v1:0", "amazon.nova-micro-v1:0", "amazon.nova-lite-v1:0"],
        ideaActionsQueue: new IdeaActionsQueue(stack, "IdeaActions").queue,
      })
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
          IDEA_ACTIONS_QUEUE_URL: { Ref: Match.stringLikeRegexp("^IdeaActionsQueue") },
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

describe("CustomerActionWorkerLambda", () => {
  const template = synthesize(
    (stack, t) =>
      new CustomerActionWorkerLambda(stack, "ActionWorker", {
        residentsTable: t.residentsTable,
        ideasTable: t.ideasTable,
        ideaActionsQueue: new IdeaActionsQueue(stack, "IdeaActions").queue,
        modelIds: ["amazon.nova-micro-v1:0"],
      })
  );

  it("runs the action controller for three minutes, calling BoroughSim only at its public URL", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "CustomerActionWorker-Prod",
      Handler: "index.runIdeaActionsController",
      Timeout: 180,
      Environment: {
        Variables: {
          RESIDENTS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^ResidentsTable") },
          RESIDENT_IDEAS_TABLE_NAME: { Ref: Match.stringLikeRegexp("^ResidentIdeasTable") },
          PUBLIC_API_BASE_URL: "https://public-api.boroughsim.com",
        },
      },
    });
  });

  it("takes one idea at a time from IdeaActions, at most two at once", () => {
    template.hasResourceProperties("AWS::Lambda::EventSourceMapping", {
      BatchSize: 1,
      ScalingConfig: { MaximumConcurrency: ACTION_WORKER_MAX_CONCURRENCY },
      EventSourceArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^IdeaActionsQueue"), "Arn"] },
    });
  });

  it("reads residents, reads and writes ideas, consumes its queue and calls only the configured model", () => {
    const granted = grants(template);
    expect(granted.filter((grant) => grant.startsWith("dynamodb:"))).toEqual([
      "dynamodb:GetItem ResidentsTable",
      "dynamodb:PutItem ResidentIdeasTable",
      "dynamodb:Query ResidentIdeasTable",
      "dynamodb:UpdateItem ResidentIdeasTable",
    ]);
    expect(granted.some((grant) => grant.startsWith("sqs:ReceiveMessage"))).toBe(true);
    const bedrock = statements(template).find((statement) => actionsOf(statement).includes("bedrock:InvokeModel"));
    expect(bedrock?.Resource).toBe("arn:aws:bedrock:us-east-1::foundation-model/amazon.nova-micro-v1:0");
  });
});

describe("IdeaActionsQueue", () => {
  const template = synthesize((stack) => new IdeaActionsQueue(stack, "IdeaActions"));

  it("outlasts the worker's timeout and dead-letters after three tries, with no alarm", () => {
    template.hasResourceProperties("AWS::SQS::Queue", {
      QueueName: "IdeaActions-Prod",
      VisibilityTimeout: 240,
      RedrivePolicy: { maxReceiveCount: 3, deadLetterTargetArn: { "Fn::GetAtt": [Match.stringLikeRegexp("^IdeaActionsDlq"), "Arn"] } },
    });
    template.hasResourceProperties("AWS::SQS::Queue", { QueueName: "IdeaActionsDlq-Prod", MessageRetentionPeriod: 1209600 });
    template.resourceCountIs("AWS::CloudWatch::Alarm", 0);
  });
});
