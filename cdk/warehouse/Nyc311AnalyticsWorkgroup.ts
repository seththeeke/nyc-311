import * as athena from "aws-cdk-lib/aws-athena";
import { Construct } from "constructs";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311AnalyticsWorkgroupProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
}

/* A guardrail, not a real limit — a full year of this data is well under 1 GB. */
const BYTES_SCANNED_CUTOFF = 5 * 1024 * 1024 * 1024;

/**
 * The Athena workgroup every warehouse query runs in
 * (`7-data-warehousing.md` §8) — pins the result location under the
 * warehouse bucket's `athena-results/` prefix and caps per-query bytes
 * scanned as a runaway guardrail.
 */
export class Nyc311AnalyticsWorkgroup extends Construct {
  public readonly workgroup: athena.CfnWorkGroup;
  public readonly workgroupName: string;

  constructor(scope: Construct, id: string, props: Nyc311AnalyticsWorkgroupProps) {
    super(scope, id);

    this.workgroupName = `Nyc311Analytics-${ENV_NAME_SUFFIX[props.envName]}`;

    this.workgroup = new athena.CfnWorkGroup(this, "WorkGroup", {
      name: this.workgroupName,
      state: "ENABLED",
      workGroupConfiguration: {
        bytesScannedCutoffPerQuery: BYTES_SCANNED_CUTOFF,
        enforceWorkGroupConfiguration: true,
        publishCloudWatchMetricsEnabled: true,
        resultConfiguration: {
          outputLocation: `s3://${props.warehouseBucket.bucketName}/athena-results/`,
        },
      },
    });
  }
}
