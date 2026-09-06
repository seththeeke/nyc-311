import { App, Stack } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { describe, expect, it } from "vitest";
import { Nyc311WarehouseBucket } from "../../warehouse/Nyc311WarehouseBucket";
import { Nyc311WarehouseCatalog } from "../../warehouse/Nyc311WarehouseCatalog";
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

  it("creates one external Parquet table per source with the schema's columns", () => {
    const t = synth("TEST");
    t.resourceCountIs("AWS::Glue::Table", WAREHOUSE_TABLE_SCHEMAS.length);

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

  it("sets Athena partition projection parameters on every table (a typo here silently breaks every query)", () => {
    const t = synth("TEST");
    const tables = t.findResources("AWS::Glue::Table");
    for (const [, table] of Object.entries(tables)) {
      const params = (table.Properties as { TableInput: { Parameters: Record<string, string> } }).TableInput.Parameters;
      expect(params["projection.enabled"]).toBe("true");
      expect(params["projection.dt.type"]).toBe("date");
      expect(params["projection.dt.format"]).toBe("yyyy-MM-dd");
      expect(params["projection.dt.range"]).toBe("2026-09-01,NOW");
      expect(params["storage.location.template"]).toMatch(
        /^s3:\/\/nyc311-warehouse-test\/data\/\w+\/dt=\$\{dt\}\/$/
      );
      expect(params["classification"]).toBe("parquet");
    }
  });

  it("makes each table depend on the database (created first)", () => {
    const t = synth("TEST");
    const tables = t.findResources("AWS::Glue::Table");
    for (const [, table] of Object.entries(tables)) {
      expect(table.DependsOn).toBeDefined();
    }
  });
});
