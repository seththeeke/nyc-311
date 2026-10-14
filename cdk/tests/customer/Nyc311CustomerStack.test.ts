import { App } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { Nyc311CustomerStack } from "../../customer/Nyc311CustomerStack";
import { actionsOf, statements } from "./customerTestSupport";

let stack: Nyc311CustomerStack;
let template: Template;
let templateJson: string;

beforeAll(() => {
  stack = new Nyc311CustomerStack(new App(), "Nyc311CustomerStack", {
    env: { account: "123456789012", region: "us-east-1" },
    stackName: "Nyc311Customer-Prod",
  });
  template = Template.fromStack(stack);
  templateJson = JSON.stringify(template.toJSON());
});

describe("Nyc311CustomerStack", () => {
  it("wires the listener milestone: one table, one Lambda, one API with one route, its own domain", () => {
    template.hasResourceProperties("AWS::DynamoDB::GlobalTable", { TableName: "WebhookCustomerFacingOrders-Prod" });
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "CustomerWebhookListener-Prod" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311CustomerApi-Prod" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "POST /webhooks/bureau" });
    template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "customer-api.boroughsim.com" });
    template.resourceCountIs("AWS::DynamoDB::GlobalTable", 1);
    template.resourceCountIs("AWS::ApiGatewayV2::Api", 1);
  });

  it("outputs the callback URL to register with the bureau", () => {
    template.hasOutput("CustomerWebhookUrl", { Value: "https://customer-api.boroughsim.com/webhooks/bureau" });
    expect(stack.webhookUrlOutput).toBeDefined();
  });

  it("is tagged as the Prod customer system", () => {
    expect(stack.tags.tagValues()).toMatchObject({ Environment: "PROD", System: "CUSTOMER" });
  });
});

/* CLAUDE.md §5.3 — the "shares nothing with Nyc311Stack" claim, asserted. */
describe("Nyc311CustomerStack isolation", () => {
  it("imports no value from any other stack", () => {
    expect(templateJson).not.toContain("Fn::ImportValue");
  });

  it("names no bureau resource anywhere in its template", () => {
    /*
     * Physical-name stems and prefixes that only the bureau's stacks use.
     * Table names are matched as whole JSON strings, since the customer's
     * own table name ends in "Orders-Prod".
     */
    const bureauMarkers = [
      "Nyc311-Prod",
      "Nyc311-Test",
      "Nyc311Api-",
      '"Orders-Prod"',
      '"Requests-Prod"',
      '"Locations-Prod"',
      '"Operators-Prod"',
      '"Users-Prod"',
      '"FeatureFlags-Prod"',
      "WebhookSubscriptions-",
      "Nyc311Webhook",
      "Nyc311Order",
      "/nyc311/",
    ];
    for (const marker of bureauMarkers) {
      expect(templateJson.includes(marker), `template mentions ${marker}`).toBe(false);
    }
    /* The bureau's API host, as distinct from the customer's own `customer-api` name. */
    expect(templateJson).not.toMatch(/[^-]api\.boroughsim\.com/);
  });

  it("grants its roles access only to its own table and its own SSM parameter", () => {
    const all = statements(template);
    expect(all.length).toBeGreaterThan(0);
    for (const statement of all) {
      expect(statement.Effect).toBe("Allow");
      const resource = JSON.stringify(statement.Resource);
      for (const action of actionsOf(statement)) {
        if (action.startsWith("dynamodb:")) {
          expect(resource).toMatch(/"Fn::GetAtt":\["WebhookCustomerFacingOrdersTable[0-9A-F]{8}","Arn"\]/);
        } else if (action.startsWith("ssm:")) {
          expect(action).toBe("ssm:GetParameter");
          expect(resource).toContain(":parameter/customer/prod/webhook/signing-secret");
        } else {
          throw new Error(`Unexpected action granted in the customer stack: ${action}`);
        }
      }
      expect(resource).not.toContain("*");
    }
  });

  it("creates no queue, topic or alarm — nothing to share and nothing to pay for", () => {
    for (const type of ["AWS::SQS::Queue", "AWS::SNS::Topic", "AWS::CloudWatch::Alarm"]) {
      template.resourceCountIs(type, 0);
    }
  });
});
