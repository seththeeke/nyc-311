import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, StreamViewType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface TeamChatTableProps {
  envName: Nyc311Environment;
}

/**
 * The one Team Chat table (docs/17-executive-team.md §10.3): pk/sk, no
 * index, a TTL on retry markers, write counters and inbox entries, and a
 * stream for a later archive or WebSocket feed. Prod is retained and
 * deletion-protected; Test is disposable.
 */
export class TeamChatTable extends TableV2 {
  constructor(scope: Construct, id: string, props: TeamChatTableProps) {
    const prod = props.envName === "PROD";
    super(scope, id, {
      tableName: `TeamChat-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "pk", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      timeToLiveAttribute: "expires_at",
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: prod },
      deletionProtection: prod,
      removalPolicy: prod ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
  }
}
