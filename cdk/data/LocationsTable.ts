import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, StreamViewType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface LocationsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Location` (`data-model.md#location`), per `ddb-design.md`'s
 * Locations table design — `location_id` (= `bbl`) as the sole key, no
 * sort key, no GSIs; every access pattern is a direct `GetItem` or a
 * conditional `PutItem` for dedup-by-`bbl`. The stream
 * (`7-data-warehousing.md` §4) feeds `Nyc311LocationsFanOutLambda` — the
 * one consumer — which republishes each new row to the warehouse; adding
 * it to the existing table is a non-replacing update.
 */
export class LocationsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: LocationsTableProps) {
    super(scope, id, {
      tableName: `Locations-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "location_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
