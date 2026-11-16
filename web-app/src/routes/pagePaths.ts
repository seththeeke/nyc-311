/*
 * The monitoring, admin, data, login and about page paths, in one place for
 * the router (pageTable.ts), the menu, the tile pages and every back-link
 * (#203). The map, residents, contacts and team paths keep their own
 * constants next to their components.
 */
export const ABOUT_PATH = "/about";
export const DATA_PATH = "/data";
export const LOGIN_PATH = "/login";

export const MONITORING_PATH = "/monitoring";
export const MONITORING_INGESTION_PATH = "/monitoring/ingestion";
export const MONITORING_PIPELINE_PATH = "/monitoring/pipeline";
export const MONITORING_LAMBDA_HEALTH_PATH = "/monitoring/lambda-health";
export const MONITORING_PUBLIC_API_PATH = "/monitoring/public-api";
export const MONITORING_CODE_QUALITY_PATH = "/monitoring/code-quality";
export const MONITORING_INTEGRATION_TESTS_PATH = "/monitoring/integration-tests";

export const ADMIN_PATH = "/admin";
export const ADMIN_CAPACITY_PATH = "/admin/capacity";
export const ADMIN_WAREHOUSE_PATH = "/admin/warehouse";
export const ADMIN_FEATURE_FLAGS_PATH = "/admin/feature-flags";
