import type { Template } from "aws-cdk-lib/assertions";

/* Shared IAM-statement helpers for the webhook Lambda tests. */

export interface Statement {
  Action: string | string[];
  Resource: unknown;
}

export function statements(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

function actionsOf(statement: Statement): string[] {
  return Array.isArray(statement.Action) ? statement.Action : [statement.Action];
}

/** Sorted `dynamodb:` actions granted on the table whose logical id starts with `tableLogicalIdPrefix`. */
export function dynamoActionsOn(template: Template, tableLogicalIdPrefix: string): string[] {
  return statements(template)
    .filter((statement) => JSON.stringify(statement.Resource).includes(`"${tableLogicalIdPrefix}`))
    .flatMap(actionsOf)
    .filter((action) => action.startsWith("dynamodb:"))
    .sort();
}

/** Every `ssm:` grant as `<action> <parameter path>`, sorted — the path is the ARN's tail after `:parameter`. */
export function ssmGrants(template: Template): string[] {
  return statements(template)
    .filter((statement) => actionsOf(statement).some((action) => action.startsWith("ssm:")))
    .flatMap((statement) => {
      const path = JSON.stringify(statement.Resource).match(/:parameter(\/[^"]+)"/)?.[1] ?? "UNPARSED";
      return actionsOf(statement).map((action) => `${action} ${path}`);
    })
    .sort();
}
