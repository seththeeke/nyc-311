import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import { CUSTOMER_API_DOMAIN, CUSTOMER_HOSTED_ZONE_ID, CUSTOMER_ROOT_DOMAIN } from "./customerConfig";

/**
 * The customer API's own custom domain: its own DNS-validated ACM
 * certificate, its own API Gateway `DomainName`, and alias records. The
 * hosted zone is the single resource shared with BoroughSim — referenced
 * by its pinned id, so there is no stack-to-stack dependency. Separate
 * from `CustomerApi` because `defaultDomainMapping` is a constructor prop.
 */
export class CustomerApiDomain extends Construct {
  public readonly domainName: apigwv2.DomainName;
  /** `https://customer-api.boroughsim.com`. */
  public readonly url: string;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    const hostedZone = route53.PublicHostedZone.fromHostedZoneAttributes(this, "HostedZone", {
      hostedZoneId: CUSTOMER_HOSTED_ZONE_ID,
      zoneName: CUSTOMER_ROOT_DOMAIN,
    });

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: CUSTOMER_API_DOMAIN,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    this.domainName = new apigwv2.DomainName(this, "DomainName", {
      domainName: CUSTOMER_API_DOMAIN,
      certificate,
    });

    const recordTarget = route53.RecordTarget.fromAlias(
      new route53targets.ApiGatewayv2DomainProperties(this.domainName.regionalDomainName, this.domainName.regionalHostedZoneId)
    );
    new route53.ARecord(this, "AliasRecord", { zone: hostedZone, recordName: CUSTOMER_API_DOMAIN, target: recordTarget });
    new route53.AaaaRecord(this, "AliasAaaaRecord", { zone: hostedZone, recordName: CUSTOMER_API_DOMAIN, target: recordTarget });

    this.url = `https://${CUSTOMER_API_DOMAIN}`;
  }
}
