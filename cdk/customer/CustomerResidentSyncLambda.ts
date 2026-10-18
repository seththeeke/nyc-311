import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { CustomerFunction } from "./CustomerFunction";
import type { ResidentsTable } from "./ResidentsTable";

export interface CustomerResidentSyncLambdaProps {
  residentsTable: ResidentsTable;
}

/**
 * The seed sync (`13-customer-simulation.md` §2 customer side, decision
 * 2): writes `Residents` from the seed files bundled into it. Invoked
 * only by CloudFormation, through `CustomerResidentSync`.
 */
export class CustomerResidentSyncLambda extends CustomerFunction {
  constructor(scope: Construct, id: string, props: CustomerResidentSyncLambdaProps) {
    super(scope, id, {
      name: "CustomerResidentSync",
      entry: ["controller", "resident", "syncResidentsController.ts"],
      handler: "syncResidentsController",
      timeout: Duration.seconds(60),
      memorySize: 256,
      environment: { RESIDENTS_TABLE_NAME: props.residentsTable.tableName },
    });
    props.residentsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:UpdateItem");
  }
}
