import { RemovalPolicy } from "aws-cdk-lib";
import { AttributeType, ProjectionType, StreamViewType, TableV2 } from "aws-cdk-lib/aws-dynamodb";
import type { Construct } from "constructs";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface RequestsTableProps {
  envName: Nyc311Environment;
}

// "Requests" is the physical name ddb-design.md's Requests table section
// locks in, but Nyc311-Test and Nyc311-Prod deploy into the same
// account/region (bin/app.ts) — an unsuffixed name would collide across
// the two stacks. Suffixing by environment (CLAUDE.md §5.3's shared
// per-environment naming convention) resolves that without changing
// anything ddb-design.md actually locked (key schema, GSIs, billing mode,
// PITR, removal policy all as designed).

/**
 * Backs `Request` (`data-model.md#request`), per `ddb-design.md`'s Requests
 * table design — including the NYC 311 ingestion cursor sentinel item
 * (`1-data-ingestion.md` §2), which lives in this same table rather than a
 * dedicated one.
 */
export class RequestsTable extends TableV2 {
  constructor(scope: Construct, id: string, props: RequestsTableProps) {
    super(scope, id, {
      tableName: `Requests-${ENV_NAME_SUFFIX[props.envName]}`,
      partitionKey: { name: "request_id", type: AttributeType.STRING },
      // Intended access pattern: GetItem(request_id) for direct lookup;
      // GetItem/PutItem on the fixed "CURSOR#NYC_311" sentinel PK for the
      // ingestion cursor.

      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: RemovalPolicy.RETAIN, // all environments, per ddb-design.md
      // Agreed 2026-08-18 (3-order-ingestion.md §2.1) — backs the
      // order-ingestion fan-out Lambda's listener. NEW_AND_OLD_IMAGES even
      // though that listener only needs the new image: this setting is
      // table-wide across every stream consumer, and changing it later
      // would mean tearing down and recreating every existing event source
      // mapping on this stream, not just adding a new one.
      dynamoStream: StreamViewType.NEW_AND_OLD_IMAGES,

      globalSecondaryIndexes: [
        {
          indexName: "gsi1-external-key",
          // Intended access pattern: ingestion dedup check by 311
          // unique_key — the highest-frequency query on this table.
          // Sparse — only NYC_311-sourced Requests populate gsi1pk; the
          // cursor sentinel item never sets it either.
          partitionKey: { name: "gsi1pk", type: AttributeType.STRING }, // external_unique_key
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi2-status",
          // Intended access pattern: draft/pending processing queues.
          partitionKey: { name: "gsi2pk", type: AttributeType.STRING }, // status
          sortKey: { name: "gsi2sk", type: AttributeType.STRING }, // created_at
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi3-location",
          // Intended access pattern: recurring-requests-at-this-address view.
          // Sparse — null while status = DRAFT.
          partitionKey: { name: "gsi3pk", type: AttributeType.STRING }, // location_id
          sortKey: { name: "gsi3sk", type: AttributeType.STRING }, // created_at
          projectionType: ProjectionType.ALL,
        },
        {
          indexName: "gsi4-poller-metrics",
          // Intended access pattern: NYC 311 poller run history
          // (1-data-ingestion.md §8a) — Query(gsi4pk="POLLER#METRICS")
          // sorted by gsi4sk (ran_at) backs the public ingestion-metrics
          // API. Sparse — only poller-metrics items set gsi4pk/gsi4sk; real
          // Request items and the CURSOR#NYC_311 sentinel never do.
          partitionKey: { name: "gsi4pk", type: AttributeType.STRING }, // "POLLER#METRICS" constant
          sortKey: { name: "gsi4sk", type: AttributeType.STRING }, // ran_at
          projectionType: ProjectionType.ALL,
        },
      ],
    });
  }
}
