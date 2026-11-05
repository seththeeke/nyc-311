import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { beforeAll, describe, expect, it } from "vitest";
import { ContactsTable } from "../../data/ContactsTable";
import { Nyc311ContactsApiLambda } from "../../lambda/Nyc311ContactsApiLambda";

function synthesize(envName: "TEST" | "PROD"): Template {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  new Nyc311ContactsApiLambda(stack, "Nyc311ContactsApiLambda", { envName, contactsTable: new ContactsTable(stack, "ContactsTable", { envName }) });
  return Template.fromStack(stack);
}

type Statement = { Action?: string | string[]; Resource?: unknown };

function statementsOf(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap((policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement);
}

describe("Nyc311ContactsApiLambda", () => {
  let template: Template;

  beforeAll(() => {
    template = synthesize("TEST");
  });

  it("bundles the contactsApiRouter on Node 22, suffixed by environment", () => {
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311ContactsApi-Test", Handler: "index.contactsApiRouter", Runtime: "nodejs22.x" });
    template.hasResource("AWS::Logs::LogGroup", { Properties: { LogGroupName: "/aws/lambda/Nyc311ContactsApi-Test" }, DeletionPolicy: "Delete" });
    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311ContactsApi-Prod" });
  });

  it("carries only the Contacts table name", () => {
    const [fn] = Object.values(template.findResources("AWS::Lambda::Function"));
    expect(Object.keys((fn.Properties as { Environment: { Variables: Record<string, unknown> } }).Environment.Variables)).toEqual(["CONTACTS_TABLE_NAME"]);
  });

  it("may only Query the Contacts table and its indexes", () => {
    const statements = statementsOf(template);
    expect(statements.flatMap((s) => (Array.isArray(s.Action) ? s.Action : [s.Action]))).toEqual(["dynamodb:Query"]);
    expect(JSON.stringify(statements[0].Resource)).toContain("/index/*");
  });
});
