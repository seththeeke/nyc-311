import * as path from "node:path";
import { Duration, RemovalPolicy, Stack } from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import type { Nyc311WarehouseCatalog } from "./Nyc311WarehouseCatalog";
import type { Nyc311AdHocQueryWorkgroup } from "./Nyc311AdHocQueryWorkgroup";
import type { UsersTable } from "../data/UsersTable";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AdHocQueryApiLambdaProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
  warehouseCatalog: Nyc311WarehouseCatalog;
  adHocQueryWorkgroup: Nyc311AdHocQueryWorkgroup;
  usersTable: UsersTable;
}

/**
 * Backs admin-authorized `POST /admin/warehouse/query`
 * (`7-data-warehousing.md` §12a, Leg 7). IAM is the real enforcement
 * boundary for a caller-supplied query string, not the controller's
 * statement-prefix check: its own dedicated Athena workgroup, read-only
 * `glue:Get*`, S3 write scoped to `athena-results/adhoc/*` only — never
 * the job runner's workgroup/prefix, no Glue/operational-table writes.
 */
export class Nyc311AdHocQueryApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311AdHocQueryApiLambdaProps) {
    const functionName = `Nyc311AdHocQueryApi-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "runAdHocQueryController.ts"),
      handler: "runAdHocQueryController",
      runtime: Runtime.NODEJS_22_X,
      /* Synchronous over API Gateway's 29s ceiling — the service's own 20s query budget plus headroom. */
      timeout: Duration.seconds(25),
      memorySize: 256,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
      environment: {
        AD_HOC_ATHENA_WORKGROUP: props.adHocQueryWorkgroup.workgroupName,
        WAREHOUSE_DATABASE_NAME: props.warehouseCatalog.databaseName,
        USERS_TABLE_NAME: props.usersTable.tableName,
      },
    });

    props.usersTable.grant(this, "dynamodb:Query", "dynamodb:PutItem");

    const stack = Stack.of(this);

    this.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["athena:StartQueryExecution", "athena:GetQueryExecution", "athena:GetQueryResults"],
        resources: [
          stack.formatArn({
            service: "athena",
            resource: "workgroup",
            resourceName: props.adHocQueryWorkgroup.workgroupName,
          }),
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
        actions: ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"],
        resources: [`${bucketArn}/athena-results/adhoc/*`],
      })
    );
  }
}
