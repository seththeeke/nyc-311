import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311AnalyticsWorkgroup } from "../../warehouse/Nyc311AnalyticsWorkgroup";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311AnalyticsWorkgroup(stack, "Nyc311AnalyticsWorkgroup", { envName, warehouseBucket });
  return Template.fromStack(stack);
}

describe("Nyc311AnalyticsWorkgroup", () => {
  it("names the workgroup per environment and pins its result location under the warehouse bucket", () => {
    synth("TEST").hasResourceProperties("AWS::Athena::WorkGroup", {
      Name: "Nyc311Analytics-Test",
      State: "ENABLED",
      WorkGroupConfiguration: {
        EnforceWorkGroupConfiguration: true,
        ResultConfiguration: { OutputLocation: "s3://nyc311-warehouse-test/athena-results/" },
      },
    });
    synth("PROD").hasResourceProperties("AWS::Athena::WorkGroup", { Name: "Nyc311Analytics-Prod" });
  });

  it("caps bytes scanned per query as a runaway guardrail", () => {
    synth("TEST").hasResourceProperties("AWS::Athena::WorkGroup", {
      WorkGroupConfiguration: { BytesScannedCutoffPerQuery: 5 * 1024 * 1024 * 1024 },
    });
  });
});
