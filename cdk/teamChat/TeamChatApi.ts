import { Duration, Stack } from "aws-cdk-lib";
import { CfnStage, CorsHttpMethod, HttpApi, type HttpMethod, type IDomainName } from "aws-cdk-lib/aws-apigatewayv2";
import { HttpJwtAuthorizer } from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import { HttpLambdaIntegration } from "aws-cdk-lib/aws-apigatewayv2-integrations";
import type { IFunction } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import type { Construct } from "constructs";
import { TEAM_CHAT_MEMBER_ROUTES, TEAM_CHAT_READ_ROUTES } from "../../backend/controller/web-api/teamChat/teamChatApiRoutes";
import { adminPoolParameterNames } from "../auth/Nyc311AdminAuth";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";
import { TEAM_CHAT_THROTTLE } from "./teamChatConfig";

export interface TeamChatApiProps {
  envName: Nyc311Environment;
  handler: IFunction;
  domainName: IDomainName;
  /** The web app's origins, allowed by CORS beside local dev. */
  webAppOrigins: string[];
}

const LOCAL_DEV_ORIGIN = "http://localhost:5173";

/**
 * The Team Chat HTTP API (docs/17-executive-team.md §10.4). Reads are open;
 * member routes use a JWT authorizer on the admin Cognito pool, whose ids
 * come from Nyc311Stack's SSM parameters at deploy time, never an export.
 */
export class TeamChatApi extends HttpApi {
  constructor(scope: Construct, id: string, props: TeamChatApiProps) {
    const suffix = ENV_NAME_SUFFIX[props.envName];
    super(scope, id, {
      apiName: `Nyc311TeamChatApi-${suffix}`,
      corsPreflight: {
        allowOrigins: [...props.webAppOrigins, LOCAL_DEV_ORIGIN],
        allowMethods: [CorsHttpMethod.GET, CorsHttpMethod.POST, CorsHttpMethod.PUT, CorsHttpMethod.PATCH, CorsHttpMethod.DELETE],
        allowHeaders: ["Content-Type", "Authorization"],
        maxAge: Duration.days(1),
      },
      defaultDomainMapping: { domainName: props.domainName },
    });

    const names = adminPoolParameterNames(suffix);
    const userPoolId = StringParameter.valueForStringParameter(this, names.userPoolId);
    const authorizer = new HttpJwtAuthorizer("TeamChatAuthorizer", `https://cognito-idp.${Stack.of(this).region}.amazonaws.com/${userPoolId}`, {
      jwtAudience: [StringParameter.valueForStringParameter(this, names.webClientId), StringParameter.valueForStringParameter(this, names.agentClientId)],
    });

    const integration = new HttpLambdaIntegration("TeamChatIntegration", props.handler, { scopePermissionToRoute: false });
    const add = (routeKey: string, withAuth: boolean): void => {
      const [method, path] = routeKey.split(" ") as [HttpMethod, string];
      this.addRoutes({ path, methods: [method], integration, ...(withAuth ? { authorizer } : {}) });
    };
    TEAM_CHAT_READ_ROUTES.forEach((routeKey) => add(routeKey, false));
    TEAM_CHAT_MEMBER_ROUTES.forEach((routeKey) => add(routeKey, true));

    const cfnStage = this.defaultStage?.node.defaultChild as CfnStage;
    cfnStage.defaultRouteSettings = { throttlingRateLimit: TEAM_CHAT_THROTTLE.rateLimit, throttlingBurstLimit: TEAM_CHAT_THROTTLE.burstLimit };
  }
}
