import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import * as route53 from "aws-cdk-lib/aws-route53";
import { describe, expect, it } from "vitest";
import { Nyc311ApiDomain } from "../../api/Nyc311ApiDomain";

const API_DOMAIN_BY_ENV = { TEST: "api.test.boroughsim.com", PROD: "api.boroughsim.com" } as const;

function synthesize(envName: "TEST" | "PROD") {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const hostedZone = route53.PublicHostedZone.fromHostedZoneAttributes(stack, "HostedZone", {
    hostedZoneId: "Z0123456789ABCDEFGHIJ",
    zoneName: "boroughsim.com",
  });
  const domain = new Nyc311ApiDomain(stack, "Nyc311ApiDomain", {
    envName,
    apiDomain: API_DOMAIN_BY_ENV[envName],
    hostedZone,
  });
  return { domain, template: Template.fromStack(stack) };
}

describe("Nyc311ApiDomain", () => {
  it("creates a DNS-validated ACM cert for the API domain", () => {
    synthesize("PROD").template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "api.boroughsim.com",
      ValidationMethod: "DNS",
    });
  });

  it("creates an API Gateway custom DomainName", () => {
    synthesize("TEST").template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", {
      DomainName: "api.test.boroughsim.com",
    });
  });

  it("creates A and AAAA alias records for the API domain in the hosted zone", () => {
    const { template } = synthesize("PROD");

    template.hasResourceProperties("AWS::Route53::RecordSet", {
      Name: "api.boroughsim.com.",
      Type: "A",
      HostedZoneId: "Z0123456789ABCDEFGHIJ",
    });
    template.hasResourceProperties("AWS::Route53::RecordSet", { Name: "api.boroughsim.com.", Type: "AAAA" });
  });

  it("exposes the https:// URL for the SPA's env-config.json", () => {
    expect(synthesize("TEST").domain.url).toBe("https://api.test.boroughsim.com");
    expect(synthesize("PROD").domain.url).toBe("https://api.boroughsim.com");
  });
});
