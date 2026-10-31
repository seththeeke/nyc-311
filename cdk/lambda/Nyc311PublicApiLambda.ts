import * as path from "node:path";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import { NodejsFunction, type ICommandHooks } from "aws-cdk-lib/aws-lambda-nodejs";
import { NYC311_LAMBDA_BUNDLING } from "./lambdaBundling";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311PublicApiLambdaProps {
  envName: Nyc311Environment;
}

/* The spec, relative to backend/, copied beside the bundled handler so publicApiService can serve it. */
const OPENAPI_SPEC = path.join("controller", "web-api", "publicV1", "openapi.yaml");

/* esbuild hooks: the only step is copying the spec in after bundling. */
export const PUBLIC_API_BUNDLING_HOOKS: ICommandHooks = {
  beforeBundling: () => [],
  beforeInstall: () => [],
  afterBundling: (inputDir: string, outputDir: string) => [
    `cp "${path.join(inputDir, OPENAPI_SPEC)}" "${path.join(outputDir, "openapi.yaml")}"`,
  ],
};

/**
 * The public API's one bundle Lambda (`16-resident-action-models.md` §2.3),
 * entry `backend/controller/web-api/publicV1/publicV1ApiRouter.ts`, serving
 * every `/v1/` route. Each operation's leg adds its own table grants.
 */
export class Nyc311PublicApiLambda extends NodejsFunction {
  constructor(scope: Construct, id: string, props: Nyc311PublicApiLambdaProps) {
    const functionName = `Nyc311PublicV1Api-${ENV_NAME_SUFFIX[props.envName]}`;

    const logGroup = new logs.LogGroup(scope, `${id}LogGroup`, {
      logGroupName: `/aws/lambda/${functionName}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    const backendRoot = path.join(__dirname, "..", "..", "backend");

    super(scope, id, {
      functionName,
      entry: path.join(backendRoot, "controller", "web-api", "publicV1", "publicV1ApiRouter.ts"),
      handler: "publicV1ApiRouter",
      runtime: Runtime.NODEJS_22_X,
      bundling: {
        ...NYC311_LAMBDA_BUNDLING,
        commandHooks: PUBLIC_API_BUNDLING_HOOKS,
      },
      timeout: Duration.seconds(10),
      memorySize: 512,
      logGroup,
      projectRoot: backendRoot,
      depsLockFilePath: path.join(backendRoot, "package-lock.json"),
    });
  }
}
