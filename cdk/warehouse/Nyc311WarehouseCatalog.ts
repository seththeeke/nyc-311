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

/* Earliest date any `dt=` partition can exist — partition projection needs a lower bound. */
const PROJECTION_START = "2026-09-01";

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
  }
}
