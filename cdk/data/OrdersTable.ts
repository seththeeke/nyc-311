import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, ProjectionType, StreamViewType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface OrdersTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Order`/`OrderEvent` (`data-model.md#order`), per `ddb-design.md`'s
 * Orders table design — `order_id` + `sk` (`#METADATA` for the projection,
 * `EVENT#<n>` for each event), sparse GSIs for stage/SLA and
 * assigned-operator lookups.
 */
export class OrdersTable extends TableV2 {
  constructor(scope: Construct, id: string, props: OrdersTableProps) {
    super(scope, id, {
      tableName: `Orders-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "order_id", type: AttributeType.STRING },
      sortKey: { name: "sk", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.RETAIN,
      globalSecondaryIndexes: [
        {
          indexName: "gsi1-stage-sla",
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING },
          sortKey: { name: "gsi1sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi2-assigned-operator",
          partitionKey: { name: "gsi2pk", type: AttributeType.STRING },
          sortKey: { name: "gsi2sk", type: AttributeType.STRING },
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
