import { Duration } from "aws-cdk-lib";
import * as logs from "aws-cdk-lib/aws-logs";
import type { Construct } from "constructs";
import type { RequestsTable } from "../data/RequestsTable";
import type { Nyc311Environment } from "../stack/Nyc311Stack";
import { Nyc311Function } from "./Nyc311Function";

export interface Nyc311PollerLambdaProps {
  envName: Nyc311Environment;
  requestsTable: RequestsTable;
}

/*
 * Custom metrics are prod-only, per 1-data-ingestion.md §8 — the same
 * env-conditional shape as everywhere else that decision applies.
 */
const METRIC_NAMESPACE = "Nyc311/Ingestion";

/**
 * The NYC 311 poller Lambda — entry point is
 * `nyc311PollerController.ts` (`1-data-ingestion.md`). Owns its own log
 * group (for the `MetricFilter`s below) and a least-privilege grant on
 * `RequestsTable` — exactly the three actions `RequestDao` calls.
 */
export class Nyc311PollerLambda extends Nyc311Function {
  public readonly pollerLogGroup: logs.LogGroup;

  constructor(scope: Construct, id: string, props: Nyc311PollerLambdaProps) {
    super(scope, id, {
      envName: props.envName,
      name: "Nyc311Poller",
      entry: ["controller", "ingestion", "nyc311PollerController.ts"],
      handler: "nyc311PollerController",
      /* Raised from 5 to 10 minutes (2026-08-22) alongside PER_RUN_RECORD_CAP's bump to 10000 — see nyc311RequestService.ts. */
      timeout: Duration.minutes(10),
      memorySize: 512,
      environment: {
        REQUESTS_TABLE_NAME: props.requestsTable.tableName,
      },
    });

    this.pollerLogGroup = this.functionLogGroup;

    /*
     * Least privilege: only the DynamoDB actions RequestDao actually issues
     * (GetItem for getCursor/getRequestById, PutItem for
     * putRequest/putCursor, Query for findByExternalUniqueKey's GSI1
     * lookup) — table.grant() adds the index ARNs automatically for
     * index-eligible actions like Query.
     */
    props.requestsTable.grant(this, "dynamodb:GetItem", "dynamodb:PutItem", "dynamodb:Query");

    if (props.envName === "PROD") {
      this.addMetricFilter("RecordsIngested", "records_ingested");
      this.addMetricFilter("DuplicatesSkipped", "duplicates_skipped");
      this.addMetricFilter("RecordsRejected", "records_rejected");
    }
  }

  /**
   * One `logs.MetricFilter` per `PollCompleted` field, per
   * 1-data-ingestion.md §8 — plain structured logs, zero metrics-awareness
   * in application code. Each filter requires both the `PollCompleted`
   * message match and the specific field's presence, since a MetricFilter's
   * `metricValue` field must appear in its own `filterPattern`.
   */
  private addMetricFilter(metricName: string, jsonField: string): void {
    new logs.MetricFilter(this, `${metricName}MetricFilter`, {
      logGroup: this.pollerLogGroup,
      metricNamespace: METRIC_NAMESPACE,
      metricName,
      filterPattern: logs.FilterPattern.all(
        logs.FilterPattern.stringValue("$.message", "=", "PollCompleted"),
        logs.FilterPattern.exists(`$.${jsonField}`)
      ),
      metricValue: `$.${jsonField}`,
    });
  }
}
