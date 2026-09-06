import * as fs from "node:fs";
import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { AnalyticsRollupsTable } from "../data/AnalyticsRollupsTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import type { Nyc311AnalyticsWorkgroup } from "./Nyc311AnalyticsWorkgroup";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseJobRunnerLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  rollupsTable: AnalyticsRollupsTable;
  warehouseBucket: Nyc311WarehouseBucket;
  warehouseCatalog: Nyc311WarehouseCatalog;
  analyticsWorkgroup: Nyc311AnalyticsWorkgroup;
}

/* The sample job's SQL (cdk/warehouse/sql/) — read at synth and baked into the Lambda env, so no runtime S3/asset fetch. */
const SAMPLE_JOB_SQL_FILE = path.join(__dirname, "sql", "order_volume_by_stage.sql");

/**
 * The daily warehouse aggregation job runner (`7-data-warehousing.md`
 * §8/§9), one Lambda rather than a Step Functions state machine — the
 * query scans kilobytes and returns in seconds. Entry point is
 * `backend/controller/analytics/runWarehouseJobController.ts`. Least-
 * privilege: `WarehouseJobRuns` read+write, `AnalyticsRollups`
 * write-only, Athena start/poll/results on the one workgroup, Glue
 * catalog reads on the one database, S3 read on `data/` + read/write on
 * `athena-results/`.
 */
export class Nyc311WarehouseJobRunnerLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311WarehouseJobRunnerLambdaProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const functionName = `Nyc311WarehouseJobRunner-${suffix}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`, /* matches Lambda's own default log group naming convention */
      retention: logs.RetentionDays.ONE_MONTH,
      /* DESTROY so a failed first-deploy rollback cleans it up rather than orphaning the name — see Nyc311OrderSchedulingLambda. */
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "analytics", "runWarehouseJobController.ts"),
      handler: "runWarehouseJobController",
      runtime: Runtime.NODEJS_22_X,
      /* The runner polls Athena up to 120s (QUERY_MAX_WAIT_MS); 180s leaves headroom for the DynamoDB writes around it. */
      timeout: Duration.seconds(180),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        SAMPLE_JOB_SQL: fs.readFileSync(SAMPLE_JOB_SQL_FILE, "utf-8"),
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        ATHENA_WORKGROUP: props.analyticsWorkgroup.workgroupName,
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
        ANALYTICS_ROLLUPS_TABLE_NAME: props.rollupsTable.tableName,
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");
    props.rollupsTable.grant(this, "dynamodb:PutItem");

    const stack = Stack.of(this);

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "athena:StartQueryExecution",
          "athena:GetQueryExecution",
          "athena:GetQueryResults",
          "athena:StopQueryExecution",
        ],
        resources: [
          stack.formatArn({ service: "athena", resource: "workgroup", resourceName: props.analyticsWorkgroup.workgroupName }),
        ],
      })
    );

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["glue:GetDatabase", "glue:GetTable", "glue:GetTables", "glue:GetPartition", "glue:GetPartitions"],
        resources: [
          stack.formatArn({ service: "glue", resource: "catalog" }),
          stack.formatArn({ service: "glue", resource: "database", resourceName: props.warehouseCatalog.databaseName }),
          stack.formatArn({ service: "glue", resource: "table", resourceName: `${props.warehouseCatalog.databaseName}/*` }),
        ],
      })
    );

    const bucketArn = props.warehouseBucket.bucket.bucketArn;
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetBucketLocation", "s3:ListBucket"],
        resources: [bucketArn],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject"],
        resources: [`${bucketArn}/data/*`],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:GetObject", "s3:PutObject"],
        resources: [`${bucketArn}/athena-results/*`],
      })
    );
  }
}
