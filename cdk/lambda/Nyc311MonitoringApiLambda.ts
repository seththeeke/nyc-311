import { Duration, Lazy, Stack, Token } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { CfnFunction } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import { agentReportsBucketName } from "../agents/AgentReportsBucket";
import type { RequestsTable } from "../data/RequestsTable";
import { PIPELINE_STATUS_FUNCTION_NAME } from "../pipeline/Nyc311PipelineStatusLambda";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311MonitoringApiLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
  /** The public API's HTTP API id — `GET /public-api/metrics` reads its built-in metrics. */
  publicApiId: string;
}

/**
 * The monitoring Service API bundle (`15-resource-consolidation.md`
 * §3.3): `GET /ingestion/metrics`, `GET /lambda-metrics`,
 * `GET /public-api/metrics` and the Code Quality reports
 * (`17-executive-team.md` §19.6, read from the account's agent reports
 * bucket, which the pipeline stack owns), entry
 * `backend/controller/web-api/monitoring/monitoringApiRouter.ts`. Its
 * timeout is the Lambda-health route's: 3 parallel CloudWatch calls per
 * Lambda in `monitoredFunctionNames`, itself among them.
 */
export class Nyc311MonitoringApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311MonitoringApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311MonitoringApi",
      entry: ["controller", "web-api", "monitoring", "monitoringApiRouter.ts"],
      handler: "monitoringApiRouter",
      timeout: Duration.seconds(25),
      memorySize: 256,
      environment: {
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
        /* Lazy, so it resolves at synth: every Lambda in the stack is listed however late it is built. */
        MONITORED_LAMBDAS: Lazy.string({ produce: () => JSON.stringify(monitoredFunctionNames(Stack.of(scope))) }),
        PUBLIC_API_ID: props.publicApiId,
        AGENT_REPORTS_BUCKET: agentReportsBucketName(Stack.of(scope).account),
      },
    });

    props.requestsTable.grant(this, "dynamodb:Query", "dynamodb:GetItem");
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["cloudwatch:GetMetricStatistics", "cloudwatch:GetMetricData"], resources: ["*"] }));
    /* Sable's published reports only: his prefix of the agent reports bucket, by name (a pipeline-stack resource, no cross-stack reference). */
    const reportsBucketArn = `arn:aws:s3:::${agentReportsBucketName(Stack.of(scope).account)}`;
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["s3:ListBucket"], resources: [reportsBucketArn], conditions: { StringLike: { "s3:prefix": ["software-analyzer-agent/*"] } } }));
    this.addToRolePolicy(new iam.PolicyStatement({ actions: ["s3:GetObject"], resources: [`${reportsBucketArn}/software-analyzer-agent/*`] }));
  }
}

/**
 * Every Lambda the health tile covers (#217): each `NodejsFunction` in the
 * stack by its literal physical name (no `Ref`, so this bundle can list
 * itself), plus the pipeline stack's status Lambda. Derived, not kept by
 * hand, so a new Lambda needs no edit here. CDK's unnamed helper functions
 * aren't `NodejsFunction`s and stay off the list.
 * @throws when a `NodejsFunction` has no literal name (CLAUDE.md §5.3).
 */
export function monitoredFunctionNames(stack: Stack): string[] {
  const names = stack.node
    .findAll()
    .filter((construct): construct is NodejsFunction => construct instanceof NodejsFunction)
    .map((fn) => {
      const name = (fn.node.defaultChild as CfnFunction).functionName;
      if (name === undefined || Token.isUnresolved(name)) {
        throw new Error(`${fn.node.path} needs a literal, env-suffixed functionName to be on the Lambda health tile`);
      }
      return name;
    });
  return [...names, PIPELINE_STATUS_FUNCTION_NAME];
}
