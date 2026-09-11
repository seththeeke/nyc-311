import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, ProjectionType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface UsersTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `User` (`data-model.md#user`), per `ddb-design.md`'s Users table
 * design — `user_id` as the sole key, no sort key, plus
 * `gsi1-cognito-sub` for the login-path lookup
 * (`9-admin-auth-integration.md` §5). No stream — no downstream consumer
 * needs `User` change capture today, same reasoning as `Locations`.
 */
export class UsersTable extends TableV2 {
  constructor(scope: Construct, id: string, props: UsersTableProps) {
    super(scope, id, {
      tableName: `Users-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "user_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: "gsi1-cognito-sub",
          /* Intended access pattern: login-path lookup by the JWT's sub claim. */
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING }, /* cognito_sub */
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
