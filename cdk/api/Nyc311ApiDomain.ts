import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53targets from "aws-cdk-lib/aws-route53-targets";
import { Construct } from "constructs";
import type { Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311ApiDomainProps {
  envName: Nyc311Environment;
  /** This environment's public API name (8-domain-name-assignment.md §1), e.g. `api.boroughsim.com`. */
  apiDomain: string;
  /** The `boroughsim.com` hosted zone (imported by attributes in Nyc311Stack). */
  hostedZone: route53.IHostedZone;
}

/**
 * The public API's custom domain (`8-domain-name-assignment.md` §2) — its
 * own DNS-validated ACM cert, an API Gateway `DomainName`, and the Route 53
 * alias records pointing at the regional API Gateway endpoint. `Nyc311Api`
 * takes `.domainName` as its `defaultDomainMapping`; nothing here depends
 * on the API itself, so it's built first.
 *
 * Kept separate from `Nyc311Api` (which extends `HttpApi`) because
 * `defaultDomainMapping` is a constructor prop — the `DomainName` has to
 * exist before `super()` runs.
 */
export class Nyc311ApiDomain extends Construct {
  public readonly domainName: apigwv2.DomainName;
  /** `https://<apiDomain>` — what the SPA's `env-config.json` and callers should use. */
  public readonly url: string;

  constructor(scope: Construct, id: string, props: Nyc311ApiDomainProps) {
    super(scope, id);

    const certificate = new acm.Certificate(this, "Certificate", {
      domainName: props.apiDomain,
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });

    this.domainName = new apigwv2.DomainName(this, "DomainName", {
      domainName: props.apiDomain,
      certificate,
    });

    const recordTarget = route53.RecordTarget.fromAlias(
      new route53targets.ApiGatewayv2DomainProperties(
        this.domainName.regionalDomainName,
        this.domainName.regionalHostedZoneId,
      ),
    );
    new route53.ARecord(this, "AliasRecord", {
      zone: props.hostedZone,
      recordName: props.apiDomain,
      target: recordTarget,
    });
    new route53.AaaaRecord(this, "AliasAaaaRecord", {
      zone: props.hostedZone,
      recordName: props.apiDomain,
      target: recordTarget,
    });

    this.url = `https://${props.apiDomain}`;
  }
}
