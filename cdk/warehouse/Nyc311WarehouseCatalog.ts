import * as glue from "aws-cdk-lib/aws-glue";
import { Aws } from "aws-cdk-lib";
import { Construct } from "constructs";
import type { Nyc311WarehouseBucket } from "./Nyc311WarehouseBucket";
import { WAREHOUSE_TABLE_SCHEMAS } from "./warehouseTableSchemas";
import { ENV_NAME_SUFFIX, type Nyc311Environment } from "../stack/Nyc311Stack";

export interface Nyc311WarehouseCatalogProps {
  envName: Nyc311Environment;
  warehouseBucket: Nyc311WarehouseBucket;
}

const PARQUET_INPUT_FORMAT = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetInputFormat";
const PARQUET_OUTPUT_FORMAT = "org.apache.hadoop.hive.ql.io.parquet.MapredParquetOutputFormat";
const PARQUET_SERDE = "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe";

const JSON_INPUT_FORMAT = "org.apache.hadoop.mapred.TextInputFormat";
const JSON_OUTPUT_FORMAT = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat";
const JSON_SERDE = "org.openx.data.jsonserde.JsonSerDe";

/* Earliest date any `dt=` / `run_date=` partition can exist — partition projection needs a lower bound. */
const PROJECTION_START = "2026-09-01";

/** The one table over `job-results/` — every job's every run, `7-data-warehousing.md` §11. */
export const JOB_RESULTS_TABLE_NAME = "job_results";

/**
 * The Glue Data Catalog for the warehouse (`7-data-warehousing.md` §7):
 * one database plus one external Parquet table per source. Manual DDL via
 * `CfnTable` (no crawler), with Athena partition projection on a single
 * `dt` (ingestion-date) partition so no `MSCK REPAIR` / partition-management
 * job is ever needed.
 */
export class Nyc311WarehouseCatalog extends Construct {
  public readonly database: glue.CfnDatabase;
  public readonly databaseName: string;
  public readonly tables: Record<string, glue.CfnTable> = {};
  /** `job_results` — one table over the whole `job-results/` prefix (§11). */
  public readonly jobResultsTable: glue.CfnTable;

  constructor(scope: Construct, id: string, props: Nyc311WarehouseCatalogProps) {
    super(scope, id);

    this.databaseName = `nyc311_warehouse_${ENV_NAME_SUFFIX[props.envName].toLowerCase()}`;
    const bucketName = props.warehouseBucket.bucketName;

    this.database = new glue.CfnDatabase(this, "Database", {
      catalogId: Aws.ACCOUNT_ID,
      databaseInput: { name: this.databaseName },
    });

    for (const schema of WAREHOUSE_TABLE_SCHEMAS) {
      const location = `s3://${bucketName}/data/${schema.tableName}/`;
      const table = new glue.CfnTable(this, `Table${schema.tableName}`, {
        catalogId: Aws.ACCOUNT_ID,
        databaseName: this.databaseName,
        tableInput: {
          name: schema.tableName,
          tableType: "EXTERNAL_TABLE",
          partitionKeys: [{ name: "dt", type: "string" }],
          parameters: {
            EXTERNAL: "TRUE",
            classification: "parquet",
            "projection.enabled": "true",
            "projection.dt.type": "date",
            "projection.dt.format": "yyyy-MM-dd",
            "projection.dt.range": `${PROJECTION_START},NOW`,
            "projection.dt.interval": "1",
            "projection.dt.interval.unit": "DAYS",
            "storage.location.template": `${location}dt=\${dt}/`,
          },
          storageDescriptor: {
            columns: schema.columns.map((c) => ({ name: c.name, type: c.type })),
            location,
            inputFormat: PARQUET_INPUT_FORMAT,
            outputFormat: PARQUET_OUTPUT_FORMAT,
            serdeInfo: { serializationLibrary: PARQUET_SERDE },
          },
        },
      });
      table.node.addDependency(this.database);
      this.tables[schema.tableName] = table;
    }

    /*
     * job_results (§11) — JSON, not Parquet, over `job-results/`. The
     * runner writes one self-describing `result.json` per job per run;
     * this table exposes them for "trend of trends" via
     * `CROSS JOIN UNNEST(rows)`. `job_name` is an `injected` projection
     * (any value, must appear in the query's WHERE — which every access
     * pattern does), so a new job needs no catalog change. `columns` /
     * `rows` mirror models/jobResult.ts.
     */
    const jobResultsLocation = `s3://${bucketName}/job-results/`;
    this.jobResultsTable = new glue.CfnTable(this, "TableJobResults", {
      catalogId: Aws.ACCOUNT_ID,
      databaseName: this.databaseName,
      tableInput: {
        name: JOB_RESULTS_TABLE_NAME,
        tableType: "EXTERNAL_TABLE",
        partitionKeys: [
          { name: "job_name", type: "string" },
          { name: "run_date", type: "string" },
        ],
        parameters: {
          EXTERNAL: "TRUE",
          classification: "json",
          "projection.enabled": "true",
          "projection.job_name.type": "injected",
          "projection.run_date.type": "date",
          "projection.run_date.format": "yyyy-MM-dd",
          "projection.run_date.range": `${PROJECTION_START},NOW`,
          "projection.run_date.interval": "1",
          "projection.run_date.interval.unit": "DAYS",
          "storage.location.template": `${jobResultsLocation}job_name=\${job_name}/run_date=\${run_date}/`,
        },
        storageDescriptor: {
          columns: [
            { name: "job_run_id", type: "string" },
            { name: "computed_at", type: "string" },
            { name: "columns", type: "array<struct<name:string,type:string>>" },
            { name: "rows", type: "array<map<string,string>>" },
          ],
          location: jobResultsLocation,
          inputFormat: JSON_INPUT_FORMAT,
          outputFormat: JSON_OUTPUT_FORMAT,
          serdeInfo: { serializationLibrary: JSON_SERDE },
        },
      },
    });
    this.jobResultsTable.node.addDependency(this.database);
  }
}
