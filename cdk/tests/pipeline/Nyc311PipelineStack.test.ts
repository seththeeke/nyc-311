import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import type { CloudAssembly } from "aws-cdk-lib/cx-api";
import { beforeAll, describe, expect, it } from "vitest";
import { NODE_22_INSTALL_COMMANDS } from "../../pipeline/node22InstallCommands";
import { Nyc311PipelineStack } from "../../pipeline/Nyc311PipelineStack";
import { NPM_CI } from "../../pipeline/npmCiCommand";

const TEST_ENV = { account: "178280182163", region: "us-east-1" };

/*
 * Synthesizing the full pipeline stack is ~3.4s of CPU; doing it once per
 * `it` (as this file used to, 9 times) is pure waste — every assertion
 * below is a read-only Template query. Synthesize once, share the
 * Template. Same reasoning as tests/stack/Nyc311Stack.test.ts's beforeAll.
 */
let template: Template;
let assembly: CloudAssembly;

beforeAll(() => {
  const app = new App();
  const stack = new Nyc311PipelineStack(app, "TestPipelineStack", { env: TEST_ENV });
  template = Template.fromStack(stack);
  assembly = app.synth();
});

describe("Nyc311PipelineStack", () => {
  it("creates a V2, self-mutating CodePipeline sourced from the externally-authorized GitHub connection", () => {
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Name: "Nyc311Pipeline",
      PipelineType: "V2",
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "Source",
          Actions: Match.arrayWith([
            Match.objectLike({
              Configuration: Match.objectLike({
                ConnectionArn:
                  "arn:aws:codeconnections:us-east-1:178280182163:connection/48eddf51-8724-497c-8ff1-c4507a78e793",
                FullRepositoryId: "seththeeke/nyc-311",
                BranchName: "main",
              }),
            }),
          ]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "UpdatePipeline",
          Actions: Match.arrayWith([Match.objectLike({ Name: "SelfMutate" })]),
        }),
      ]),
    });
  });

  it("sizes compute per step: Synth LARGE, integration and browser smoke gates MEDIUM, everything else SMALL (CI cost, 2026-10-03)", () => {
    const projects = Object.values(template.findResources("AWS::CodeBuild::Project")).map(
      (project) => project.Properties as { Description: string; Environment: { ComputeType: string } }
    );
    const computeFor = (step: string): string[] =>
      projects.filter((p) => p.Description.endsWith(`/${step}`)).map((p) => p.Environment.ComputeType);

    expect(computeFor("Build/Synth")).toEqual(["BUILD_GENERAL1_LARGE"]);
    expect(computeFor("DeployTest/IntegrationTestsTest")).toEqual(["BUILD_GENERAL1_MEDIUM"]);
    expect(computeFor("DeployProd/IntegrationTestsProd")).toEqual(["BUILD_GENERAL1_MEDIUM"]);
    expect(computeFor("DeployTest/BrowserSmokeTestsTest")).toEqual(["BUILD_GENERAL1_MEDIUM"]);
    const rest = projects.filter((p) => !/\/(Build\/Synth|IntegrationTests(Test|Prod)|BrowserSmokeTestsTest)$/.test(p.Description));
    expect(rest.length).toBeGreaterThan(0);
    for (const project of rest) {
      expect(project.Environment.ComputeType).toBe("BUILD_GENERAL1_SMALL");
    }
  });

  it("installs Node 22 via a fresh n download in every step that runs repo code, never runtime-versions (#167, #179)", () => {
    /* Assets/FileAssets' buildspec is a YAML file in the assembly, not inline, so it is checked by the next test. */
    const inline = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((project) => project.Properties as { Description: string; Source: { BuildSpec: unknown } })
      .filter((p) => typeof p.Source.BuildSpec === "string" && p.Source.BuildSpec.trimStart().startsWith("{"))
      .map((p) => ({
        step: p.Description.split("/").pop() as string,
        spec: JSON.parse(p.Source.BuildSpec as string) as { phases: { install?: Record<string, unknown> & { commands?: string[] } } },
      }));
    /* BrowserSmokeTestsTest (#215) and PublishCoverage (#222) run on the image's Node; their own test files check that. */
    const imageNodeSteps = ["SelfMutate", "BrowserSmokeTestsTest", "PublishCoverageTest", "PublishCoverageProd"];
    const repoSteps = inline.filter(({ step }) => !imageNodeSteps.includes(step));

    expect(repoSteps.map(({ step }) => step).sort()).toEqual(["IntegrationTestsProd", "IntegrationTestsTest", "ProdDiff", "Synth"]);
    for (const { spec } of repoSteps) {
      expect(spec.phases.install).not.toHaveProperty("runtime-versions");
      /* Only CDK's own artifact-link `ln -s` lines may precede it; they need no Node. */
      const commands = (spec.phases.install?.commands ?? []).filter((c) => !c.includes("ln -s --"));
      expect(commands.slice(0, NODE_22_INSTALL_COMMANDS.length)).toEqual(NODE_22_INSTALL_COMMANDS);
    }
    expect(NODE_22_INSTALL_COMMANDS[0]).toMatch(/^N_CACHE_PREFIX="\$\(mktemp -d\)" n "\$NODE_22_VERSION"$/);
  });

  it("leaves SelfMutate and FileAssets on the image's default Node: they run only aws-cdk/cdk-assets (#209)", () => {
    const selfMutate = Object.values(template.findResources("AWS::CodeBuild::Project"))
      .map((project) => project.Properties as { Description: string; Source: { BuildSpec: string } })
      .filter((p) => p.Description.endsWith("/SelfMutate"));
    expect(selfMutate).toHaveLength(1);
    const selfMutateSpec = JSON.parse(selfMutate[0].Source.BuildSpec) as {
      phases: { install: Record<string, unknown> & { commands: string[] } };
    };
    expect(selfMutateSpec.phases.install).not.toHaveProperty("runtime-versions");
    expect(selfMutateSpec.phases.install.commands).toEqual(["npm install -g aws-cdk@2"]);

    const assetSpecs = readdirSync(assembly.directory).filter((f) => /^buildspec-.*-FileAsset\.yaml$/.test(f));
    expect(assetSpecs).toHaveLength(1);
    const spec = JSON.parse(readFileSync(join(assembly.directory, assetSpecs[0]), "utf8")) as {
      phases: { install: Record<string, unknown> & { commands: string[] } };
    };

    expect(spec.phases.install).not.toHaveProperty("runtime-versions");
    expect(spec.phases.install.commands).toEqual(["npm install -g cdk-assets@latest"]);
  });

  it("publishes every file asset from one CodeBuild project, not one per asset (publishAssetsInParallel: false)", () => {
    const projects = Object.values(template.findResources("AWS::CodeBuild::Project")).map(
      (project) => (project.Properties as { Description: string }).Description
    );

    expect(projects.filter((d) => d.includes("/Assets/"))).toEqual([expect.stringMatching(/\/Assets\/FileAssets$/)]);
  });

  it("synths and diffs against bin/pipeline.ts explicitly, not cdk.json's default app", () => {
    /*
     * Regression test: cdk.json's default app (bin/app.ts) only defines
     * the bare Nyc311-Test/Nyc311-Prod stacks, not Nyc311PipelineStack or
     * the Stage-wrapped structure self-mutation and the deploy actions
     * need — omitting --app here previously produced a cloud assembly
     * self-mutation couldn't find its own stack in.
     */
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          'cdk synth --app \\\\"npx ts-node --prefer-ts-exts bin/pipeline\\.ts\\\\"',
        ),
      }),
    });
    template.hasResourceProperties("AWS::CodeBuild::Project", {
      Source: Match.objectLike({
        BuildSpec: Match.stringLikeRegexp(
          'cdk diff Nyc311-Prod --app \\\\"npx ts-node --prefer-ts-exts bin/pipeline\\.ts\\\\"',
        ),
      }),
    });
  });

  it("deploys Nyc311-Test and Nyc311-Prod as pipeline stages, with a coverage publish, and integration tests after", () => {
    /*
     * The coverage-publish and integration-test post steps run in
     * parallel (same RunOrder), and CDK Pipelines doesn't render them in
     * the array order they were passed to `post` — asserted independently
     * below rather than as one ordered arrayWith (which requires its
     * patterns to match as an in-order subsequence), so this doesn't
     * become order-dependent.
     */
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([Match.objectLike({ Name: "PublishCoverageTest" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployTest",
          Actions: Match.arrayWith([Match.objectLike({ Name: "IntegrationTestsTest" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "PublishCoverageProd" })]),
        }),
      ]),
    });
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "DeployProd",
          Actions: Match.arrayWith([Match.objectLike({ Name: "IntegrationTestsProd" })]),
        }),
      ]),
    });
  });

  it("runs the non-blocking ProdDiff beside DeployTest's post steps, not serially before DeployProd (#198)", () => {
    type Action = { Name: string; RunOrder: number };
    type Stage = { Name: string; Actions: Action[] };
    const pipelines = Object.values(template.findResources("AWS::CodePipeline::Pipeline"));
    const stages = (pipelines[0].Properties as { Stages: Stage[] }).Stages;
    const actions = (name: string): Action[] => stages.find((stage) => stage.Name === name)?.Actions ?? [];
    const runOrder = (name: string): number | undefined =>
      actions("DeployTest").find((action) => action.Name === name)?.RunOrder;

    expect(actions("DeployProd").map((action) => action.Name)).not.toContain("ProdDiff");
    expect(runOrder("ProdDiff")).toBeDefined();
    expect(runOrder("ProdDiff")).toBe(runOrder("BrowserSmokeTestsTest"));
    expect(runOrder("ProdDiff")).toBe(runOrder("IntegrationTestsTest"));
  });

  it("skips a doc-only or agent-tooling-only push via a V2 trigger filter, rather than running the full pipeline on every push (#112, #211)", () => {
    template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
      Stages: Match.arrayWith([
        Match.objectLike({
          Name: "Source",
          Actions: Match.arrayWith([
            Match.objectLike({
              Configuration: Match.objectLike({ DetectChanges: false }),
            }),
          ]),
        }),
      ]),
      Triggers: Match.arrayWith([
        Match.objectLike({
          ProviderType: "CodeStarSourceConnection",
          GitConfiguration: Match.objectLike({
            Push: Match.arrayWith([
              Match.objectLike({
                Branches: { Includes: ["main"] },
                FilePaths: {
                  Excludes: [
                    "docs/**",
                    "agent-web-app/**",
                    "agent-reports/**",
                    ".claude/**",
                    "scripts/agent-*.sh",
                    "scripts/agent-*.py",
                    "scripts/agent-schedules/**",
                  ],
                },
              }),
            ]),
          }),
        }),
      ]),
    });
  });

  it("wires a pipeline-failure-only notification rule to an email-subscribed SNS topic", () => {
    template.hasResourceProperties("AWS::SNS::Subscription", {
      Protocol: "email",
      Endpoint: "seththeeke@gmail.com",
    });
    template.hasResourceProperties("AWS::CodeStarNotifications::NotificationRule", {
      DetailType: "FULL",
      EventTypeIds: ["codepipeline-pipeline-pipeline-execution-failed"],
    });
  });

  it("denies the nyc311 CLI user sts:AssumeRole on the CDK deploy and cfn-exec roles", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: "Nyc311DenyDirectDeploy",
      Users: ["seththeeke-cli"],
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "DenyAssumeCdkDeployRoles",
            Effect: "Deny",
            Action: "sts:AssumeRole",
            Resource: [
              "arn:aws:iam::178280182163:role/cdk-hnb659fds-deploy-role-178280182163-us-east-1",
              "arn:aws:iam::178280182163:role/cdk-hnb659fds-cfn-exec-role-178280182163-us-east-1",
            ],
          }),
        ]),
      }),
    });
  });

  it("also denies the nyc311 CLI user direct CloudFormation mutation on Nyc311-Test, Nyc311-Prod and the customer stack only, closing the AdministratorAccess fallback", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyName: "Nyc311DenyDirectDeploy",
      Users: ["seththeeke-cli"],
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Sid: "DenyDirectCloudFormationMutation",
            Effect: "Deny",
            Action: [
              "cloudformation:CreateStack",
              "cloudformation:UpdateStack",
              "cloudformation:DeleteStack",
              "cloudformation:CreateChangeSet",
              "cloudformation:ExecuteChangeSet",
              "cloudformation:DeleteChangeSet",
            ],
            Resource: [
              "arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311-Test/*",
              "arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311-Prod/*",
              "arn:aws:cloudformation:us-east-1:178280182163:stack/Nyc311Customer-Prod/*",
            ],
          }),
        ]),
      }),
    });
  });

  it("deploys the customer as its own stage after DeployProd, so BoroughSim's Prod deploy finishes first (13-customer-simulation.md)", () => {
    const [pipeline] = Object.values(template.findResources("AWS::CodePipeline::Pipeline"));
    const stages = pipeline.Properties.Stages as { Name: string; Actions: { Name: string; Configuration?: { StackName?: string } }[] }[];
    const names = stages.map((stage) => stage.Name);

    expect(names.indexOf("DeployCustomer")).toBe(names.indexOf("DeployProd") + 1);
    const customerStage = stages[names.indexOf("DeployCustomer")];
    const deployedStacks = customerStage.Actions.map((action) => action.Configuration?.StackName).filter(Boolean);
    expect(new Set(deployedStacks)).toEqual(new Set(["Nyc311Customer-Prod"]));
    /* And BoroughSim's stages never deploy it. */
    for (const stageName of ["DeployTest", "DeployProd"]) {
      const stage = stages[names.indexOf(stageName)];
      expect(JSON.stringify(stage)).not.toContain("Nyc311Customer");
    }
  });

  it("lints and tests the customer package in Synth, in its own background subshell (#220)", () => {
    const buildSpecs = Object.values(template.findResources("AWS::CodeBuild::Project")).map((project) =>
      JSON.stringify(project.Properties.Source.BuildSpec)
    );
    const synthSpec = buildSpecs.find((spec) => spec.includes("npm run test:coverage:ci"));
    expect(synthSpec).toContain("(cd customer/backend && npm ci --no-audit --no-fund && npm run lint && npm run test:coverage) & CUSTOMER_PID=$!");
  });

  it("backgrounds backend/'s and customer/backend/'s Synth lint+test alongside web-app/'s, and gates on all three (#220)", () => {
    const buildSpecs = Object.values(template.findResources("AWS::CodeBuild::Project")).map((project) =>
      JSON.stringify(project.Properties.Source.BuildSpec)
    );
    const synthSpec = buildSpecs.find((spec) => spec.includes("npm run test:coverage:ci"));
    expect(synthSpec).toContain("(cd backend && npm ci --no-audit --no-fund && npm run lint && npm run test:coverage) & BACKEND_PID=$!");
    expect(synthSpec).toContain("WEBAPP_STATUS=$?");
    expect(synthSpec).toContain("wait $BACKEND_PID; BACKEND_STATUS=$?");
    expect(synthSpec).toContain("wait $CUSTOMER_PID; CUSTOMER_STATUS=$?");
    /* synthSpec is JSON.stringify-ed twice over (CDK's buildspec, then this test's own dump); strip backslashes to compare the literal command text. */
    expect(synthSpec?.replace(/\\/g, "")).toContain(
      '[ "$WEBAPP_STATUS" -eq 0 ] && [ "$BACKEND_STATUS" -eq 0 ] && [ "$CUSTOMER_STATUS" -eq 0 ]',
    );
  });

  it("skips npm's built-in audit on every npm ci in every CodeBuild step (#200)", () => {
    const buildSpecs = Object.values(template.findResources("AWS::CodeBuild::Project")).map((project) =>
      JSON.stringify(project.Properties.Source.BuildSpec)
    );
    const installs = buildSpecs.flatMap((spec) => spec.match(/npm ci[^&"\\]*/g) ?? []);
    /* Synth x4, ProdDiff, IntegrationTests x2, PublishCoverage x2. */
    expect(installs.length).toBe(9);
    for (const install of installs) {
      expect(install.trim()).toBe(NPM_CI);
    }
  });

  it("wires the pipeline-status API/Lambda, scoped to this pipeline's own ARN", () => {
    template.hasResourceProperties("AWS::Lambda::Function", { FunctionName: "Nyc311PipelineStatus" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Api", { Name: "Nyc311PipelineStatusApi" });
    template.hasResourceProperties("AWS::ApiGatewayV2::Route", { RouteKey: "GET /pipeline/status" });
    template.hasOutput("Nyc311PipelineStatusApiUrl", {});
  });

  it("expires old pipeline artifacts instead of keeping every execution's objects forever (#192)", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      LifecycleConfiguration: Match.objectLike({
        Rules: Match.arrayWith([
          Match.objectLike({
            Id: "ExpireOldPipelineArtifacts",
            Status: "Enabled",
            ExpirationInDays: 14,
            NoncurrentVersionExpiration: Match.objectLike({ NoncurrentDays: 1 }),
            AbortIncompleteMultipartUpload: Match.objectLike({ DaysAfterInitiation: 7 }),
          }),
        ]),
      }),
    });
  });

  it("does not restrict direct deploys of the pipeline stack itself, the recovery path for a broken Synth step", () => {
    const [{ Properties }] = Object.values(
      template.findResources("AWS::IAM::Policy", {
        Properties: { PolicyName: "Nyc311DenyDirectDeploy" },
      }),
    ) as { Properties: { PolicyDocument: { Statement: { Sid: string; Resource: string[] }[] } } }[];

    const cfnStatement = Properties.PolicyDocument.Statement.find(
      (s) => s.Sid === "DenyDirectCloudFormationMutation",
    );
    const coversPipelineStack = cfnStatement?.Resource.some((r) =>
      r.includes("TestPipelineStack"),
    );

    expect(coversPipelineStack).toBe(false);
  });
});
