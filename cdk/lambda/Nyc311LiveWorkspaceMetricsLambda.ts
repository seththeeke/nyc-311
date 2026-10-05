import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { LiveWorkspaceMetricsTable } from "../data/LiveWorkspaceMetricsTable";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { Nyc311LiveWorkspaceMetricsQueue } from "./Nyc311LiveWorkspaceMetricsQueue";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311LiveWorkspaceMetricsLambdaProps {
  envName: Nyc311Environment;
  ordersTable: OrdersTable;
  operatorsTable: OperatorsTable;
  liveWorkspaceMetricsTable: LiveWorkspaceMetricsTable;
  liveWorkspaceMetricsQueue: Nyc311LiveWorkspaceMetricsQueue;
}

/* Real DB work per message (a Query, a GetItem, a transaction), same sizing as Nyc311OrderEvaluationLambda. */
const BATCH_SIZE = 10;

/**
 * Folds each accepted/resolved Order into its New York day's bucket in
 * {@link LiveWorkspaceMetricsTable} — the write side of the secondary
 * workspace's live tiles. Consumes {@link Nyc311LiveWorkspaceMetricsQueue};
 * retry/DLQ is the queue's own redrive policy. Entry point is
 * `backend/controller/analytics/recordWorkspaceMetricsController.ts`.
 */
export class Nyc311LiveWorkspaceMetricsLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311LiveWorkspaceMetricsLambdaProps) {
    const functionName = `Nyc311LiveWorkspaceMetrics-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "analytics", "recordWorkspaceMetricsController.ts"),
      handler: "recordWorkspaceMetricsController",
      runtime: Runtime.NODEJS_22_X,
      bundling: NYC311_LAMBDA_BUNDLING,
      timeout: Duration.seconds(30),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        LIVE_WORKSPACE_METRICS_TABLE_NAME: props.liveWorkspaceMetricsTable.tableName,
      },
    });

    this.addEventSource(
      new SqsEventSource(props.liveWorkspaceMetricsQueue.queue, {
        batchSize: BATCH_SIZE,
        reportBatchItemFailures: true,
      })
    );

    /* Least privilege: read one Order's events (Query), one Operator's rate (GetItem), and the marker + bucket transaction (Put + Update). */
    props.ordersTable.grant(this, "dynamodb:Query");
    props.operatorsTable.grant(this, "dynamodb:GetItem");
    props.liveWorkspaceMetricsTable.grant(this, "dynamodb:PutItem", "dynamodb:UpdateItem");
  }
}
