import type { WarehouseJobDefinitionListResponse } from "../models/warehouseJobDefinition";

/*
 * Baked sample data for "mock" data mode (config.ts) — mirrors the four
 * jobs backfilled onto this architecture in the real environments
 * (7-data-warehousing.md §8's Migration note), most-recently-created
 * first (GET /admin/warehouse/jobs's own order).
 */
export const MOCK_WAREHOUSE_JOB_DEFINITIONS: WarehouseJobDefinitionListResponse = {
  jobs: [
    {
      job_run_id: "DEF#operator_fleet_cost_to_date",
      record_type: "DEFINITION",
      job_name: "operator_fleet_cost_to_date",
      sql_s3_key: "job-definitions/operator_fleet_cost_to_date.sql",
      cadence_cron: "cron(0 9 * * ? *)",
      schedule_name: "Nyc311WarehouseJob-operator_fleet_cost_to_date-Test",
      created_at: "2026-09-13T19:04:11.000Z",
      created_by: "01ADMIN0000000000000000001",
    },
    {
      job_run_id: "DEF#order_volume_by_borough",
      record_type: "DEFINITION",
      job_name: "order_volume_by_borough",
      sql_s3_key: "job-definitions/order_volume_by_borough.sql",
      cadence_cron: "cron(0 9 * * ? *)",
      schedule_name: "Nyc311WarehouseJob-order_volume_by_borough-Test",
      created_at: "2026-09-13T19:04:10.000Z",
      created_by: "01ADMIN0000000000000000001",
    },
    {
      job_run_id: "DEF#order_volume_by_stage_8w",
      record_type: "DEFINITION",
      job_name: "order_volume_by_stage_8w",
      sql_s3_key: "job-definitions/order_volume_by_stage_8w.sql",
      cadence_cron: "cron(0 9 * * ? *)",
      schedule_name: "Nyc311WarehouseJob-order_volume_by_stage_8w-Test",
      created_at: "2026-09-13T19:04:09.000Z",
      created_by: "01ADMIN0000000000000000001",
    },
    {
      job_run_id: "DEF#order_volume_by_stage_7d",
      record_type: "DEFINITION",
      job_name: "order_volume_by_stage_7d",
      sql_s3_key: "job-definitions/order_volume_by_stage_7d.sql",
      cadence_cron: "cron(0 9 * * ? *)",
      schedule_name: "Nyc311WarehouseJob-order_volume_by_stage_7d-Test",
      created_at: "2026-09-13T19:04:08.000Z",
      created_by: "01ADMIN0000000000000000001",
    },
  ],
};
