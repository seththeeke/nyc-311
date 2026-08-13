import { App } from "aws-cdk-lib";
import { Nyc311PipelineStack } from "../pipeline/Nyc311PipelineStack";

const app = new App();

new Nyc311PipelineStack(app, "Nyc311PipelineStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
