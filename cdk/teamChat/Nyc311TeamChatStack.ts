import { CfnOutput, Stack, type StackProps, Tags } from "aws-cdk-lib";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import { Nyc311ApiDomain } from "../api/Nyc311ApiDomain";
import { DOMAIN_CONFIG, FAILURE_NOTIFICATION_EMAIL, HOSTED_ZONE_ID, ROOT_DOMAIN, type Nyc311Environment } from "../stack/Nyc311Stack";
import { TeamChatAlarms } from "./TeamChatAlarms";
import { TeamChatApi } from "./TeamChatApi";
import { TeamChatApiLambda } from "./TeamChatApiLambda";
import { TEAM_CHAT_API_DOMAIN } from "./teamChatConfig";
import { TeamChatSeedSync } from "./TeamChatSeedSync";
import { TeamChatTable } from "./TeamChatTable";

export interface Nyc311TeamChatStackProps extends StackProps {
  envName: Nyc311Environment;
  /** Fixed seed hash for tests. */
  seedHash?: string;
}

/**
 * Team Chat (docs/17-executive-team.md §10), the third standing exception
 * to the single-stack rule (CLAUDE.md §5.3): its table, Lambda, HTTP API,
 * domain and alarms, in Test and Prod. It reads the admin pool's ids from
 * SSM; the stage deploys it after Nyc311Stack.
 */
export class Nyc311TeamChatStack extends Stack {
  /** `https://chat-api[.test].boroughsim.com`, for the integration tests. */
  public readonly chatApiUrlOutput: CfnOutput;

  constructor(scope: Construct, id: string, props: Nyc311TeamChatStackProps) {
    super(scope, id, props);
    Tags.of(this).add("Environment", props.envName);
    Tags.of(this).add("System", "TEAM_CHAT");

    const table = new TeamChatTable(this, "TeamChatTable", { envName: props.envName });
    const apiLambda = new TeamChatApiLambda(this, "TeamChatApiLambda", { envName: props.envName, table });
    new TeamChatSeedSync(this, "TeamChatSeedSync", { envName: props.envName, table, ...(props.seedHash ? { seedHash: props.seedHash } : {}) });

    const hostedZone = route53.PublicHostedZone.fromHostedZoneAttributes(this, "HostedZone", { hostedZoneId: HOSTED_ZONE_ID, zoneName: ROOT_DOMAIN });
    const domain = new Nyc311ApiDomain(this, "TeamChatApiDomain", { envName: props.envName, apiDomain: TEAM_CHAT_API_DOMAIN[props.envName], hostedZone });
    new TeamChatApi(this, "TeamChatApi", {
      envName: props.envName,
      handler: apiLambda,
      domainName: domain.domainName,
      webAppOrigins: [`https://${DOMAIN_CONFIG[props.envName].siteDomain}`],
    });
    new TeamChatAlarms(this, "TeamChatAlarms", { envName: props.envName, apiLogGroup: apiLambda.logGroup, notificationEmail: FAILURE_NOTIFICATION_EMAIL });

    this.chatApiUrlOutput = new CfnOutput(this, "TeamChatApiUrl", { value: domain.url });
  }
}
