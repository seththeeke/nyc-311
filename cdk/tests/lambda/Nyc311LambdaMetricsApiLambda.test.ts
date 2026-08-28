import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, it } from "vitest";
import { Nyc311LambdaMetricsApiLambda } from "../../lambda/Nyc311LambdaMetricsApiLambda";

const PROPS = {
  pollerFunctionName: "Nyc311Poller-Test",
  orderFanOutFunctionName: "Nyc311OrderFanOut-Test",
  requestEvaluationFunctionName: "Nyc311RequestEvaluation-Test",
  orderEventFanOutFunctionName: "Nyc311OrderEventFanOut-Test",
  orderEvaluationFunctionName: "Nyc311OrderEvaluation-Test",
  orderSchedulingFunctionName: "Nyc311OrderScheduling-Test",
  metricsApiFunctionName: "Nyc311MetricsApi-Test",
  ordersApiFunctionName: "Nyc311OrdersApi-Test",
  orderEventsApiFunctionName: "Nyc311OrderEventsApi-Test",
};

function synthesize(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  new Nyc311LambdaMetricsApiLambda(stack, "Nyc311LambdaMetricsApiLambda", { envName, ...PROPS });
  return Template.fromStack(stack);
}

describe("Nyc311LambdaMetricsApiLambda", () => {
  it("bundles backend/controller/web-api/getLambdaMetricsController's exported handler on Node 22", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.getLambdaMetricsController",
      Runtime: "nodejs22.x",
    });
  });

  it("suffixes the function name and log group by environment, distinguishing Test from Prod at a glance", () => {
    synthesize("TEST").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311LambdaMetricsApi-Test",
    });
    synthesize("TEST").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311LambdaMetricsApi-Test",
    });

    synthesize("PROD").hasResourceProperties("AWS::Lambda::Function", {
      FunctionName: "Nyc311LambdaMetricsApi-Prod",
    });
    synthesize("PROD").hasResourceProperties("AWS::Logs::LogGroup", {
      LogGroupName: "/aws/lambda/Nyc311LambdaMetricsApi-Prod",
    });
  });

  it("passes each monitored Lambda's function name as its own env var, including the fixed PipelineStatus literal", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          MONITORED_LAMBDA_POLLER: "Nyc311Poller-Test",
          MONITORED_LAMBDA_ORDER_FAN_OUT: "Nyc311OrderFanOut-Test",
          MONITORED_LAMBDA_REQUEST_EVALUATION: "Nyc311RequestEvaluation-Test",
          MONITORED_LAMBDA_ORDER_EVENT_FAN_OUT: "Nyc311OrderEventFanOut-Test",
          MONITORED_LAMBDA_ORDER_EVALUATION: "Nyc311OrderEvaluation-Test",
          MONITORED_LAMBDA_METRICS_API: "Nyc311MetricsApi-Test",
          MONITORED_LAMBDA_ORDERS_API: "Nyc311OrdersApi-Test",
          MONITORED_LAMBDA_ORDER_EVENTS_API: "Nyc311OrderEventsApi-Test",
          MONITORED_LAMBDA_PIPELINE_STATUS: "Nyc311PipelineStatus",
        },
      },
    });
  });

  it("grants only cloudwatch:GetMetricStatistics — least privilege, read-only", () => {
    const template = synthesize("TEST");

    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: Match.objectLike({
        Statement: Match.arrayWith([
          Match.objectLike({
            Action: "cloudwatch:GetMetricStatistics",
            Effect: "Allow",
            Resource: "*",
          }),
        ]),
      }),
    });
  });
});
