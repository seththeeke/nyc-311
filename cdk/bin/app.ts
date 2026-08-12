import { App } from "aws-cdk-lib";
import { CivicFieldServicesStack } from "../stack/CivicFieldServicesStack";

const app = new App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

new CivicFieldServicesStack(app, "CivicFieldServices-Test", { envName: "TEST", env });
new CivicFieldServicesStack(app, "CivicFieldServices-Prod", { envName: "PROD", env });
