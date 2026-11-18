import { Duration } from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { OperatorsTable } from "../data/OperatorsTable";
import type { OrdersTable } from "../data/OrdersTable";
import type { LocationsTable } from "../data/LocationsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311FleetApiLambdaProps {
  envName: Nyc311Environment;
  operatorsTable: OperatorsTable;
  ordersTable: OrdersTable;
  locationsTable: LocationsTable;
}

/**
 * The fleet Service API bundle (`15-resource-consolidation.md` §3.3):
 * `GET /fleet/locations`, the home-page map's data source
 * (`10-capacity-modeling-and-integration.md` §6.1). Entry:
 * `backend/controller/web-api/fleet/fleetApiRouter.ts`. Keeps its
 * pre-bundle function name, so the cutover replaced no resource. Public,
 * so no UsersTable grant. Read-only on `OperatorsTable`, `OrdersTable`'s
 * recent-jobs trail and `LocationsTable`'s batched lookups.
 */
export class Nyc311FleetApiLambda extends Nyc311Function {
  constructor(scope: Construct, id: string, props: Nyc311FleetApiLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311GetFleetLocationsApi",
      entry: ["controller", "web-api", "fleet", "fleetApiRouter.ts"],
      handler: "fleetApiRouter",
      timeout: Duration.seconds(20),
      memorySize: 1769, /* one full vCPU — at 256 MB (~1/7 vCPU) SDK overhead alone took 6-10s and hit the timeout */
      tracing: true,
      environment: {
        OPERATORS_TABLE_NAME: props.operatorsTable.tableName,
        ORDERS_TABLE_NAME: props.ordersTable.tableName,
        LOCATIONS_TABLE_NAME: props.locationsTable.tableName,
      },
    });

    props.operatorsTable.grant(this, "dynamodb:Query");
    props.ordersTable.grant(this, "dynamodb:Query");
    props.locationsTable.grant(this, "dynamodb:BatchGetItem");
  }
}
