import { Stack, StackProps } from "aws-cdk-lib";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codestarconnections from "aws-cdk-lib/aws-codestarconnections";
import * as iam from "aws-cdk-lib/aws-iam";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as pipelines from "aws-cdk-lib/pipelines";
import type { Construct } from "constructs";
import { Nyc311AppStage } from "./Nyc311AppStage";

// aws-code-pipeline-plan.md §3 — GitHub is the permanent source host.
const GITHUB_OWNER = "seththeeke";
const GITHUB_REPO = "nyc-311";
const GITHUB_BRANCH = "main";

// aws-code-pipeline-plan.md §4.1.
const FAILURE_NOTIFICATION_EMAIL = "seththeeke@gmail.com";

// aws-code-pipeline-plan.md §7/§9 — the `nyc311` CLI profile's identity,
// whose direct deploy access is revoked once this stack is live.
const NYC311_CLI_USER_NAME = "seththeeke-cli";

// The default CDK bootstrap qualifier this account was bootstrapped with
// (`cdk bootstrap --profile nyc311`, no `--qualifier` override).
const CDK_BOOTSTRAP_QUALIFIER = "hnb659fds";

/**
 * The self-mutating CI/CD pipeline (`aws-code-pipeline-plan.md`). This is
 * the standing exception to `CLAUDE.md` §5.3's single-stack rule — CI/CD
 * tooling, not application infrastructure, deployed once by hand and then
 * self-mutating from `main` thereafter.
 */
export class Nyc311PipelineStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    const connection = new codestarconnections.CfnConnection(
      this,
      "GitHubConnection",
      {
        connectionName: "nyc311-github-connection",
        providerType: "GitHub",
      },
    );

    const source = pipelines.CodePipelineSource.connection(
      `${GITHUB_OWNER}/${GITHUB_REPO}`,
      GITHUB_BRANCH,
      { connectionArn: connection.attrConnectionArn },
    );

    // §4 "Synth (Build/Test)" row: lint + unit test + coverage for
    // backend/ and cdk/, then cdk synth. Each command returns to repo
    // root before the next so ordering doesn't depend on whether the
    // CodeBuild shell persists `cd` across buildspec lines.
    const synth = new pipelines.ShellStep("Synth", {
      input: source,
      commands: [
        "cd backend && npm ci && npm run lint && npm run test:coverage && cd ..",
        "cd cdk && npm ci && npm run lint && npm run test:coverage && npm run build && cd ..",
        "cd cdk && npx cdk synth",
      ],
      primaryOutputDirectory: "cdk/cdk.out",
    });

    // §1.1 — self-mutation runs immediately after Synth (the earliest
    // possible point). `pipelineType: V2` is explicit below; its
    // underlying `codepipeline.Pipeline` defaults `executionMode` to
    // `SUPERSEDED` (confirmed against the aws-cdk-lib type definitions —
    // no override needed), which is the second guarantee against a stale
    // step running after a structural change, on top of CodePipeline's
    // own behavior of reading each stage's actions from the live
    // pipeline definition.
    const pipeline = new pipelines.CodePipeline(this, "Pipeline", {
      pipelineName: "Nyc311Pipeline",
      synth,
      selfMutation: true,
      pipelineType: codepipeline.PipelineType.V2,
      codeBuildDefaults: {
        buildEnvironment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_7_0,
        },
      },
    });

    const env = { account: this.account, region: this.region };

    pipeline.addStage(
      new Nyc311AppStage(this, "DeployTest", { env, envName: "TEST" }),
    );

    // §4 "cdk diff visibility (non-blocking)" row — reuses the same
    // GitHub source (not the synthesized assembly) so it's a plain,
    // self-contained `cdk diff` from source; `|| true` guarantees it
    // never fails the pipeline regardless of diff content or transient
    // errors.
    const prodDiff = new pipelines.ShellStep("ProdDiff", {
      input: source,
      commands: ["cd cdk && npm ci && npx cdk diff Nyc311-Prod || true"],
    });

    pipeline.addStage(
      new Nyc311AppStage(this, "DeployProd", { env, envName: "PROD" }),
      { pre: [prodDiff] },
    );

    // Must build the pipeline before reaching into the underlying
    // `codepipeline.Pipeline` for notifications (CDK Pipelines README).
    pipeline.buildPipeline();

    // §4.1 — the sole human-intervention trigger: any stage failure
    // notifies by email.
    const failureTopic = new sns.Topic(this, "PipelineFailureTopic", {
      topicName: "Nyc311PipelineFailures",
    });
    failureTopic.addSubscription(
      new subscriptions.EmailSubscription(FAILURE_NOTIFICATION_EMAIL),
    );
    pipeline.pipeline.notifyOn("PipelineFailureNotification", failureTopic, {
      events: [codepipeline.PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED],
    });

    // §7/§9 — revoke the `nyc311` CLI profile's ability to deploy.
    // Shipped in this stack's own definition, so the one bootstrap deploy
    // both stands up the pipeline and revokes direct deploy access in the
    // same changeset — it doesn't affect the pipeline's own service-role
    // principal, which is different from the `nyc311` user this Deny is
    // scoped to.
    const nyc311CliUser = iam.User.fromUserName(
      this,
      "Nyc311CliUser",
      NYC311_CLI_USER_NAME,
    );
    const denyDirectDeploy = new iam.Policy(this, "DenyNyc311DirectDeploy", {
      policyName: "Nyc311DenyDirectDeploy",
      statements: [
        // Belt: deny assuming the two roles `cdk deploy`/`destroy` use to
        // mutate CloudFormation. The lookup role is left untouched so
        // `cdk diff`/`synth` keep working locally.
        new iam.PolicyStatement({
          sid: "DenyAssumeCdkDeployRoles",
          effect: iam.Effect.DENY,
          actions: ["sts:AssumeRole"],
          resources: [
            `arn:aws:iam::${this.account}:role/cdk-${CDK_BOOTSTRAP_QUALIFIER}-deploy-role-${this.account}-${this.region}`,
            `arn:aws:iam::${this.account}:role/cdk-${CDK_BOOTSTRAP_QUALIFIER}-cfn-exec-role-${this.account}-${this.region}`,
          ],
        }),
        // Suspenders: `seththeeke-cli` has `AdministratorAccess` attached
        // directly, so when it can't assume the deploy role, the CDK CLI
        // falls back to mutating CloudFormation with the ambient
        // credentials directly — the AssumeRole deny above alone doesn't
        // stop that. This denies the actual mutating actions on the three
        // governed stacks specifically, regardless of which credentials
        // or role performed the call, so the fallback path is closed too.
        new iam.PolicyStatement({
          sid: "DenyDirectCloudFormationMutation",
          effect: iam.Effect.DENY,
          actions: [
            "cloudformation:CreateStack",
            "cloudformation:UpdateStack",
            "cloudformation:DeleteStack",
            "cloudformation:CreateChangeSet",
            "cloudformation:ExecuteChangeSet",
            "cloudformation:DeleteChangeSet",
          ],
          resources: [
            `arn:aws:cloudformation:${this.region}:${this.account}:stack/Nyc311-Test/*`,
            `arn:aws:cloudformation:${this.region}:${this.account}:stack/Nyc311-Prod/*`,
            `arn:aws:cloudformation:${this.region}:${this.account}:stack/${this.stackName}/*`,
          ],
        }),
      ],
    });
    denyDirectDeploy.attachToUser(nyc311CliUser);
  }
}
