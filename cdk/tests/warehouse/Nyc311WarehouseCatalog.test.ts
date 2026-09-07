import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog, JOB_RESULTS_TABLE_NAME } from "../../warehouse/Nyc311WarehouseCatalog";
import { WAREHOUSE_TABLE_SCHEMAS } from "../../warehouse/warehouseTableSchemas";

function synth(envName: "TEST" | "PROD"): Template {
  const app = new App();
  const stack = new Stack(app, "TestStack", { env: { region: "us-east-1" } });
  const warehouseBucket = new Nyc311WarehouseBucket(stack, "Nyc311WarehouseBucket", { envName });
  new Nyc311WarehouseCatalog(stack, "Nyc311WarehouseCatalog", { envName, warehouseBucket });
  return Template.fromStack(stack);
}

describe("Nyc311WarehouseCatalog", () => {
  it("creates one Glue database named per environment", () => {
    synth("TEST").hasResourceProperties("AWS::Glue::Database", {
      DatabaseInput: { Name: "nyc311_warehouse_test" },
    });
    synth("PROD").hasResourceProperties("AWS::Glue::Database", {
      DatabaseInput: { Name: "nyc311_warehouse_prod" },
    });
  });

  it("creates one external Parquet table per source plus the job_results table", () => {
    const t = synth("TEST");
    t.resourceCountIs("AWS::Glue::Table", WAREHOUSE_TABLE_SCHEMAS.length + 1);

    for (const schema of WAREHOUSE_TABLE_SCHEMAS) {
      t.hasResourceProperties("AWS::Glue::Table", {
        DatabaseName: "nyc311_warehouse_test",
        TableInput: Match.objectLike({
          Name: schema.tableName,
          TableType: "EXTERNAL_TABLE",
          PartitionKeys: [{ Name: "dt", Type: "string" }],
          StorageDescriptor: Match.objectLike({
            Columns: schema.columns.map((c) => ({ Name: c.name, Type: c.type })),
            SerdeInfo: {
              SerializationLibrary: "org.apache.hadoop.hive.ql.io.parquet.serde.ParquetHiveSerDe",
            },
          }),
        }),
      });
    }
  });

  it("sets date partition projection on every source table (a typo here silently breaks every query)", () => {
    const t = synth("TEST");
    for (const schema of WAREHOUSE_TABLE_SCHEMAS) {
      t.hasResourceProperties("AWS::Glue::Table", {
        TableInput: Match.objectLike({
          Name: schema.tableName,
          Parameters: Match.objectLike({
            "projection.enabled": "true",
            "projection.dt.type": "date",
            "projection.dt.format": "yyyy-MM-dd",
            "projection.dt.range": "2026-09-01,NOW",
            "storage.location.template": `s3://nyc311-warehouse-test/data/${schema.tableName}/dt=\${dt}/`,
            classification: "parquet",
          }),
        }),
      });
    }
  });

  it("declares job_results — JSON, over job-results/, injected job_name + date run_date projection, rows as a string map", () => {
    synth("TEST").hasResourceProperties("AWS::Glue::Table", {
      DatabaseName: "nyc311_warehouse_test",
      TableInput: Match.objectLike({
        Name: JOB_RESULTS_TABLE_NAME,
        TableType: "EXTERNAL_TABLE",
        PartitionKeys: [
          { Name: "job_name", Type: "string" },
          { Name: "run_date", Type: "string" },
        ],
        Parameters: Match.objectLike({
          classification: "json",
          "projection.enabled": "true",
          "projection.job_name.type": "injected",
          "projection.run_date.type": "date",
          "projection.run_date.range": "2026-09-01,NOW",
          "storage.location.template":
            "s3://nyc311-warehouse-test/job-results/job_name=${job_name}/run_date=${run_date}/",
        }),
        StorageDescriptor: Match.objectLike({
          Columns: [
            { Name: "job_run_id", Type: "string" },
            { Name: "computed_at", Type: "string" },
            { Name: "columns", Type: "array<struct<name:string,type:string>>" },
            { Name: "rows", Type: "array<map<string,string>>" },
          ],
          Location: "s3://nyc311-warehouse-test/job-results/",
          SerdeInfo: { SerializationLibrary: "org.openx.data.jsonserde.JsonSerDe" },
        }),
      }),
    });
  });

  it("makes each table depend on the database (created first)", () => {
    const t = synth("TEST");
    const tables = t.findResources("AWS::Glue::Table");
    for (const [, table] of Object.entries(tables)) {
      expect(table.DependsOn).toBeDefined();
    }
  });
});
