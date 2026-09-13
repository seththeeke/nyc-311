import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311AdHocQueryWorkgroup } from "../../warehouse/Nyc311AdHocQueryWorkgroup";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311AdHocQueryWorkgroup(stack, "Nyc311AdHocQueryWorkgroup", { envName, warehouseBucket });
  return Template.fromStack(stack);
}

describe("Nyc311AdHocQueryWorkgroup", () => {
  it("names the workgroup per environment and pins its result location under its own adhoc/ prefix", () => {
    synth("TEST").hasResourceProperties("AWS::Athena::WorkGroup", {
      Name: "Nyc311AdHocQueries-Test",
      State: "ENABLED",
      WorkGroupConfiguration: {
        EnforceWorkGroupConfiguration: true,
        ResultConfiguration: { OutputLocation: "s3://nyc311-warehouse-test/athena-results/adhoc/" },
      },
    });
    synth("PROD").hasResourceProperties("AWS::Athena::WorkGroup", { Name: "Nyc311AdHocQueries-Prod" });
  });

  it("caps bytes scanned per query tighter than the job runner's workgroup", () => {
    synth("TEST").hasResourceProperties("AWS::Athena::WorkGroup", {
      WorkGroupConfiguration: { BytesScannedCutoffPerQuery: 1 * 1024 * 1024 * 1024 },
    });
  });
});
