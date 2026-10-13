import { App, Stack } from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { CustomerApiDomain } from "../../customer/CustomerApiDomain";

function synthesize(): { template: Template; domain: CustomerApiDomain } {
  const stack = new Stack(new App(), "TestStack", { env: { region: "us-east-1" } });
  const domain = new CustomerApiDomain(stack, "CustomerApiDomain");
  return { template: Template.fromStack(stack), domain };
}

describe("CustomerApiDomain", () => {
  it("issues its own DNS-validated certificate for customer-api.boroughsim.com", () => {
    synthesize().template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: "customer-api.boroughsim.com",
      ValidationMethod: "DNS",
    });
  });

  it("creates its own API Gateway domain name and exposes the https URL", () => {
    const { template, domain } = synthesize();
    template.hasResourceProperties("AWS::ApiGatewayV2::DomainName", { DomainName: "customer-api.boroughsim.com" });
    expect(domain.url).toBe("https://customer-api.boroughsim.com");
  });

  it("adds A and AAAA alias records to the shared hosted zone, referenced by its pinned id", () => {
    const { template } = synthesize();
    for (const type of ["A", "AAAA"]) {
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: "customer-api.boroughsim.com.",
        Type: type,
        HostedZoneId: "Z014904580HQD5MMLQWU",
      });
    }
  });
});
