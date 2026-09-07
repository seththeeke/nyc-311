import * as fs from "node:fs";
import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { WarehouseJobRunsTable } from "../data/WarehouseJobRunsTable";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import type { Nyc311AnalyticsWorkgroup } from "./Nyc311AnalyticsWorkgroup";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseJobRunnerLambdaProps {
  envName: Nyc311Environment;
  jobRunsTable: WarehouseJobRunsTable;
  warehouseBucket: Nyc311WarehouseBucket;
  warehouseCatalog: Nyc311WarehouseCatalog;
  analyticsWorkgroup: Nyc311AnalyticsWorkgroup;
}

const SQL_DIR = path.join(__dirname, "sql");

/**
 * The registered jobs (`7-data-warehousing.md` §8) — every `.sql` file in
 * `cdk/warehouse/sql/`, read at synth and passed as the `WAREHOUSE_JOBS`
 * env var so the runner never fetches an asset at runtime. `name` is the
 * file basename (S3 partition value + `WarehouseJobRuns.job_name`).
 */
function readJobManifest(): { name: string; sql: string }[] {
  return fs
    .readdirSync(SQL_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => ({ name: f.replace(/\.sql$/, ""), sql: fs.readFileSync(path.join(SQL_DIR, f), "utf-8") }));
}

/**
 * The daily warehouse job runner (`7-data-warehousing.md` §8/§9) — one
 * generic Lambda, not per-job Step Functions. Entry:
 * `backend/controller/analytics/runWarehouseJobController.ts`. Per job it
 * runs the Athena query and writes the resultset envelope to
 * `job-results/` (§11); it never touches the Glue catalog. Least-
 * privilege: Athena on the one workgroup, read-only `glue:Get*`, S3 read
 * on `data/`, read/write on `job-results/` + `athena-results/`,
 * `WarehouseJobRuns` read+write.
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
      /* Polls Athena up to 120s per job (QUERY_MAX_WAIT_MS); 300s covers a few jobs plus the DynamoDB/S3 writes. */
      timeout: Duration.seconds(300),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        WAREHOUSE_JOBS: JSON.stringify(readJobManifest()),
        JOB_RESULTS_BUCKET: props.warehouseBucket.bucketName,
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        ATHENA_WORKGROUP: props.analyticsWorkgroup.workgroupName,
        WAREHOUSE_JOB_RUNS_TABLE_NAME: props.jobRunsTable.tableName,
      },
    });

    props.jobRunsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");

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
        resources: [`${bucketArn}/job-results/*`, `${bucketArn}/athena-results/*`],
      })
    );
    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:DeleteObject"],
        resources: [`${bucketArn}/athena-results/*`],
      })
    );
  }
}
