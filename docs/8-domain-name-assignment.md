# Domain Name Assignment — Design & Build Doc

> Closes [#4](https://github.com/seththeeke/nyc-311/issues/4). Everything
> public-facing runs on raw AWS-generated hostnames today
> (`*.cloudfront.net`, `*.execute-api.us-east-1.amazonaws.com`). The
> `boroughsim.com` domain is now registered in the project's AWS account
> (Route 53 hosted zone `Z014904580HQD5MMLQWU`). This doc assigns real
> names to the sites and the public API, and rebrands the user-facing app
> from "NYC 311" to "BoroughSim".
>
> Unlike the earlier design docs this was not a long negotiation — the
> owner specified the target names directly. It's written up here so the
> build session (and a later reader) doesn't have to re-derive the wiring.

---

## 1. Name assignment

| Environment | Site | Public API (`Nyc311Api`) |
|---|---|---|
| **Prod** (`Nyc311-Prod`) | `boroughsim.com` (apex) | `api.boroughsim.com` |
| **Test** (`Nyc311-Test`) | `test.boroughsim.com` | `api.test.boroughsim.com` |

Not getting a custom domain (out of scope for this pass, unchanged):

- **`Nyc311PipelineStatusApi`** — a singleton in `Nyc311PipelineStack`,
  not per-environment, and `2-pipeline-monitoring.md` §9 already
  established it doesn't need runtime URL injection. Stays on its
  `execute-api` URL; only its **CORS allow-list** gains the new site
  domains (§4).
- The **`Nyc311ApiUrl` CloudFormation output** keeps emitting the raw
  `apiEndpoint`. The pipeline's integration-test step reads it as
  `API_BASE_URL` immediately after a deploy — before DNS/cert propagation
  for a brand-new custom domain is guaranteed — so pointing it at the
  custom domain would risk a flaky first run. Revisit once the custom
  domains are proven.

## 2. Hosted zone, certificates, DNS

- **Hosted zone** — referenced by static attributes
  (`PublicHostedZone.fromHostedZoneAttributes`, id
  `Z014904580HQD5MMLQWU` + name `boroughsim.com`), **not**
  `HostedZone.fromLookup`. A lookup needs `route53:List*` in the pipeline's
  synth role and writes `cdk.context.json`; the id is stable and the
  codebase already hardcodes infra ids elsewhere with an "update by hand
  if recreated" note (`websiteHostingTargets.ts`,
  `Nyc311PipelineStatusApi.ts`). One shared reference per stack, exported
  from `stack/Nyc311Stack.ts` alongside `ENV_NAME_SUFFIX`.
- **Certificates** — one ACM certificate per consumer, DNS-validated
  against the hosted zone (`CertificateValidation.fromDns`), created by
  the construct that owns the thing it secures:
  - `WebsiteHosting` creates its own cert for the site domain and attaches
    it to the CloudFront distribution (already in `us-east-1`, so no
    cross-region cert dance).
  - `Nyc311ApiDomain` (new construct) creates its own cert for the API
    domain and attaches it to the API Gateway custom domain.
  - Per-consumer rather than one shared `*.boroughsim.com` wildcard: a
    wildcard doesn't cover `api.test.boroughsim.com` (two labels deep),
    and per-consumer keeps each cert's lifecycle with its construct.
- **DNS records** — each construct creates its own alias records in the
  hosted zone: `A` + `AAAA` for the site (alias → CloudFront), `A` +
  `AAAA` for the API (alias → the regional API Gateway domain).

## 3. CDK changes

| File | Change |
|---|---|
| `stack/Nyc311Stack.ts` | Export `ROOT_DOMAIN`, `HOSTED_ZONE_ID`, and `DOMAIN_CONFIG: Record<Nyc311Environment, { siteDomain; apiDomain }>`. Look the zone up once; pass `siteDomain`/`hostedZone` to `WebsiteHosting`, construct `Nyc311ApiDomain`, pass its `IDomainName` + both allowed web origins to `Nyc311Api`, and point `WebsiteDeployment.apiBaseUrl` at `https://<apiDomain>`. |
| `web/WebsiteHosting.ts` | New props `siteDomain`, `hostedZone`. Create the ACM cert; add `domainNames` + `certificate` to the `Distribution`; add `ARecord` + `AaaaRecord` alias → `CloudFrontTarget`. |
| `api/Nyc311ApiDomain.ts` | **New construct.** ACM cert + `apigatewayv2.DomainName` + `ARecord`/`AaaaRecord` alias → `ApiGatewayv2DomainProperties`. Exposes `.domainName` (`IDomainName`) and `.url` (`https://<apiDomain>`). |
| `api/Nyc311Api.ts` | `webAppDomainName: string` → `webAppDomainNames: string[]` (CORS allows the custom site domain **and** the CloudFront default — issue #4's "keep both for now"). New `apiDomainName: IDomainName` prop → `defaultDomainMapping`. `apiEndpoint` (raw) still exposed for the CfnOutput. |
| `pipeline/Nyc311PipelineStatusApi.ts` | Add `https://test.boroughsim.com` / `https://boroughsim.com` to the CORS allow-list; keep the two `*.cloudfront.net` entries for now. |
| `web/ensureDistDirectory.ts` | Placeholder `<title>` → `BoroughSim`. |

`websiteHostingTargets.ts` and the pipeline invalidation steps are
**unchanged** — adding an alias + cert to an existing `Distribution` is a
CloudFormation update in place, not a replacement, so the hardcoded
distribution ids stay valid.

## 4. Rebrand (user-facing only)

Scope: browser tab / page identity only. Internal identifiers
(`Nyc311Stack`, `Nyc311*` construct + logical ids, physical resource
names, the `nyc311` CLI profile, the `nyc-311` repo, `nyc311-web-*`
buckets) are **left as-is** — renaming them means CloudFormation resource
replacement and pipeline rework, well beyond this issue.

References to **"NYC 311" as an upstream data source** (the NYC 311 SODA
open-data feed the poller reads) are accurate and stay.

| File | Change |
|---|---|
| `web-app/index.html` | `<title>NYC 311</title>` → `BoroughSim` |
| `web-app/src/components/pages/HomePage.tsx` | `<h1>` → `BoroughSim` |
| `web-app/src/components/pages/MonitoringPage.tsx` | `Live · Nyc311` badge → `Live · BoroughSim` |
| `web/ensureDistDirectory.ts` | (above) |

Local-dev `web-app/.env.local` (git-ignored) still points `VITE_API_BASE_URL`
at the Test `execute-api` URL — update it by hand to
`https://api.test.boroughsim.com` if wanted; not part of the deploy.

## 5. Testing

- `cdk/tests/api/Nyc311ApiDomain.test.ts` — **new**: cert domain + DNS
  validation, `DomainName` resource, alias records.
- `cdk/tests/web/WebsiteHosting.test.ts` — cert + `Aliases` on the
  distribution + `A`/`AAAA` records; helper now passes a stub hosted zone.
- `cdk/tests/api/Nyc311Api.test.ts` — CORS now lists both web origins;
  `defaultDomainMapping` present; helper passes a stub `DomainName`.
- `cdk/tests/web/WebsiteDeployment.test.ts` — helper updated for the new
  `WebsiteHosting` props.
- `cdk/tests/stack/Nyc311Stack.test.ts` — asserts the API `DomainName`,
  the CloudFront alias, and the site/API `A` records per environment.
  (`env-config.json` is a staged asset, not template-visible;
  `Nyc311ApiDomain.url` is unit-tested directly instead.)
- `cdk/tests/pipeline/Nyc311PipelineStatusApi.test.ts` — CORS list gains
  the two site domains.
- `web-app/tests/routes/AppRoutes.test.tsx`,
  `web-app/tests/components/pages/HomePage.test.tsx` — heading text.

`cdk` + `web-app` each: `build` + `lint` + `test:coverage` (≥90%/file) all
green. `backend` is untouched.

## 6. Deploy & propagation

Single commit → pipeline. On the first deploy CloudFormation will:

1. Create the two ACM certs and their Route 53 validation records, and
   **wait** for validation (usually minutes on a Route 53-hosted domain).
2. Create the API Gateway `DomainName`s and the site/API alias records.
3. Update each CloudFront distribution in place with its alias + cert.

CloudFront distribution updates take ~5–15 min to propagate. Until then
the `*.cloudfront.net` URLs keep working (nothing removed). After the
pipeline is green, verify in `Nyc311-Test`:

- `https://test.boroughsim.com` serves the SPA; `https://api.test.boroughsim.com/orders` returns 200.
- `https://boroughsim.com` + `https://api.boroughsim.com/orders` likewise for Prod.
- The monitoring tiles (which call the API + pipeline-status API from the
  new origin) load without CORS errors.

## 7. Naming reference

| Piece | Name |
|---|---|
| Root domain / hosted zone | `boroughsim.com` / `Z014904580HQD5MMLQWU` |
| Prod site / API | `boroughsim.com` / `api.boroughsim.com` |
| Test site / API | `test.boroughsim.com` / `api.test.boroughsim.com` |
| New construct | `cdk/api/Nyc311ApiDomain.ts` |
| Shared config | `DOMAIN_CONFIG`, `ROOT_DOMAIN`, `HOSTED_ZONE_ID` in `stack/Nyc311Stack.ts` |
| Product name (UI) | BoroughSim |
