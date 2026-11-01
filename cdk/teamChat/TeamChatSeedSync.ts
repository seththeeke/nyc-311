import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { CustomResource, Duration, RemovalPolicy } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import * as cr from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import { BACKEND_ROOT, TeamChatFunction } from "./TeamChatFunction";
import type { TeamChatTable } from "./TeamChatTable";

/* The files whose change must re-run the sync: the seeds and the code that writes them. */
const SEED_SOURCES = [
  ["service", "teamChat", "teamChatSeeds.ts"],
  ["service", "teamChat", "teamChatSeedService.ts"],
  ["dao", "teamChat", "teamChatDao.ts"],
];

/** A hash of the seed sources, so a deploy re-syncs exactly when they change. */
export function teamChatSeedHash(): string {
  const hash = createHash("sha256");
  for (const segments of SEED_SOURCES) hash.update(readFileSync(path.join(BACKEND_ROOT, ...segments)));
  return hash.digest("hex");
}

export interface TeamChatSeedSyncProps {
  envName: Nyc311Environment;
  table: TeamChatTable;
  /** Defaults to {@link teamChatSeedHash}; tests pass a fixed one. */
  seedHash?: string;
}

/**
 * Syncs Team Chat's seeded members and channels (docs/17-executive-team.md
 * §10.2) on every deploy that changes them, through a custom resource.
 */
export class TeamChatSeedSync extends Construct {
  constructor(scope: Construct, id: string, props: TeamChatSeedSyncProps) {
    super(scope, id);
    const suffix = ENV_NAME_SUFFIX[props.envName];
    const syncLambda = new TeamChatFunction(this, "SyncLambda", {
      envName: props.envName,
      name: "TeamChatSeedSync",
      entry: ["controller", "teamChat", "syncTeamChatSeedsController.ts"],
      handler: "syncTeamChatSeedsController",
      timeout: Duration.seconds(60),
      memorySize: 512,
      environment: { TEAM_CHAT_TABLE_NAME: props.table.tableName, TEAM_CHAT_ENV: props.envName },
    });
    props.table.grant(syncLambda, "dynamodb:UpdateItem");

    const providerName = `TeamChatSeedSyncProvider-${suffix}`;
    const provider = new cr.Provider(this, "Provider", {
      onEventHandler: syncLambda,
      providerFunctionName: providerName,
      logGroup: new logs.LogGroup(this, "ProviderLogGroup", {
        logGroupName: `/aws/lambda/${providerName}`,
        retention: logs.RetentionDays.ONE_MONTH,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });
    new CustomResource(this, "Resource", {
      serviceToken: provider.serviceToken,
      resourceType: "Custom::TeamChatSeedSync",
      properties: { SeedHash: props.seedHash ?? teamChatSeedHash() },
    });
  }
}
