import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface LocationsTableProps {
  envName: Nyc311Environment;
}

/**
 * Backs `Location` (`data-model.md#location`), per `ddb-design.md`'s
 * Locations table design — `location_id` (= `bbl`) as the sole key, no
 * sort key, no GSIs; every access pattern is a direct `GetItem` or a
 * conditional `PutItem` for dedup-by-`bbl`.
 */
export class LocationsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: LocationsTableProps) {
    super(scope, id, {
      tableName: `Locations-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "location_id", type: AttributeType.STRING },
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN,
    });
  }
}
