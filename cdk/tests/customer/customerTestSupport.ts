import type { Template } from "aws-cdk-lib/assertions";

/* Shared IAM-statement helpers for the customer construct tests. */

export interface Statement {
  Effect: string;
  Action: string | string[];
  Resource: unknown;
}

/** Every statement in every IAM policy in the template. */
export function statements(template: Template): Statement[] {
  return Object.values(template.findResources("AWS::IAM::Policy")).flatMap(
    (policy) => (policy.Properties as { PolicyDocument: { Statement: Statement[] } }).PolicyDocument.Statement
  );
}

export function actionsOf(statement: Statement): string[] {
  return Array.isArray(statement.Action) ? statement.Action : [statement.Action];
}
