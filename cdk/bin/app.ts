import { App } from "aws-cdk-lib";
import { Nyc311Stack } from "../stack/Nyc311Stack";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new Nyc311Stack(app, "Nyc311-Test", { envName: "TEST", env });
new Nyc311Stack(app, "Nyc311-Prod", { envName: "PROD", env });
