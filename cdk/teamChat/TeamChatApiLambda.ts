import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { TeamChatFunction } from "./TeamChatFunction";
import type { TeamChatTable } from "./TeamChatTable";

export interface TeamChatApiLambdaProps {
  envName: Nyc311Environment;
  table: TeamChatTable;
}

/**
 * The teamChat bundle (docs/17-executive-team.md §10.1): every Team Chat
 * route. Reads and writes the one table, nothing else.
 */
export class TeamChatApiLambda extends TeamChatFunction {
  constructor(scope: Construct, id: string, props: TeamChatApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "TeamChatApi",
      entry: ["controller", "web-api", "teamChat", "teamChatApiRouter.ts"],
      handler: "teamChatApiRouter",
      timeout: Duration.seconds(10),
      memorySize: 1024,
      environment: { TEAM_CHAT_TABLE_NAME: props.table.tableName },
    });
    props.table.grant(this, "dynamodb:GetItem", "dynamodb:Query", "dynamodb:PutItem", "dynamodb:UpdateItem", "dynamodb:ConditionCheckItem");
  }
}
