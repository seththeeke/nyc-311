import * as athena from "aws-cdk-lib/aws-athena";
import { Construct } from "constructs";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AdHocQueryWorkgroupProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
}

/*
 * Tighter than Nyc311AnalyticsWorkgroup's 5 GB — a runaway admin-typed
 * CROSS JOIN shouldn't be able to scan much, even though real data volume
 * needs neither cutoff (7-data-warehousing.md §12a).
 */
const BYTES_SCANNED_CUTOFF = 1 * 1024 * 1024 * 1024;

/**
 * A second, dedicated Athena workgroup for the admin ad-hoc SQL console
 * (`7-data-warehousing.md` §12a, Leg 7) — deliberately not
 * `Nyc311Analytics` (the scheduled job runner's workgroup), so an admin's
 * one-off query can't affect the daily jobs' metrics or share their
 * cutoff budget. Own output prefix (`athena-results/adhoc/`) for the same
 * reason.
 */
export class Nyc311AdHocQueryWorkgroup extends Construct {
  public readonly workgroup: athena.CfnWorkGroup;
  public readonly workgroupName: string;

  constructor(scope: Construct, id: string, props: Nyc311AdHocQueryWorkgroupProps) {
    super(scope, id);

    this.workgroupName = `Nyc311AdHocQueries-${ENV_NAME_SUFFIX[props.envName]}`;

    this.workgroup = new athena.CfnWorkGroup(this, "WorkGroup", {
      name: this.workgroupName,
      state: "ENABLED",
      workGroupConfiguration: {
        bytesScannedCutoffPerQuery: BYTES_SCANNED_CUTOFF,
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: `s3://${props.warehouseBucket.bucketName}/athena-results/adhoc/`,
        },
      },
    });
  }
}
