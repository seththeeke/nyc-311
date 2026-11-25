import { lazy, type ComponentType } from "react";
import { CONTACTS_PAGE_FLAG, CONTACTS_PAGE_ON } from "../models/featureTreatment";
import { CONTACTS_PATH } from "../components/contacts/contactRoutes";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH } from "../components/residents/residentRoutes";
import { TEAM_CHAT_PATH, TEAM_PATH } from "../components/team/teamRoutes";
import {
  ADMIN_CAPACITY_PATH,
  ADMIN_FEATURE_FLAGS_PATH,
  ADMIN_PATH,
  ADMIN_WAREHOUSE_PATH,
  DATA_PATH,
  LOGIN_PATH,
  MONITORING_CODE_QUALITY_PATH,
  MONITORING_INGESTION_PATH,
  MONITORING_INTEGRATION_TESTS_PATH,
  MONITORING_LAMBDA_HEALTH_PATH,
  MONITORING_PATH,
  MONITORING_PIPELINE_PATH,
  MONITORING_PUBLIC_API_PATH,
} from "./pagePaths";

/** A flag gating a page: it renders only on the `onTreatments` treatments. */
export interface PageFlagRule {
  key: string;
  onTreatments: readonly string[];
}

/*
 * One row per flat page (#203): AppRoutes builds each route from it and a test
 * checks the menu and tiles against it. `PUBLIC` pages go through PublicRoute
 * (then FeatureFlagRoute when flagged), `ADMIN` pages through AdminRoute.
 */
export interface PageRoute {
  path: string;
  tier: "PUBLIC" | "ADMIN";
  flag?: PageFlagRule;
  Page: ComponentType;
}

/*
 * Every page is dynamic-imported so Vite/Rollup emits it as its own chunk
 * instead of folding them all (SQL console, charts, diagrams, the 3-D map)
 * into one bundle — `npm run build` flagged that bundle at 802 kB minified.
 */
const ResidentsPage = lazy(() => import("../components/pages/ResidentsPage").then((m) => ({ default: m.ResidentsPage })));
const ContactsPage = lazy(() => import("../components/pages/ContactsPage").then((m) => ({ default: m.ContactsPage })));
const ResidentIdeaPage = lazy(() =>
  import("../components/pages/ResidentIdeaPage").then((m) => ({ default: m.ResidentIdeaPage }))
);
const TeamPage = lazy(() => import("../components/pages/TeamPage").then((m) => ({ default: m.TeamPage })));
const TeamChatPage = lazy(() => import("../components/pages/TeamChatPage").then((m) => ({ default: m.TeamChatPage })));
const DataPage = lazy(() => import("../components/pages/DataPage").then((m) => ({ default: m.DataPage })));
const MonitoringPage = lazy(() => import("../components/pages/MonitoringPage").then((m) => ({ default: m.MonitoringPage })));
const IngestionMonitoringPage = lazy(() =>
  import("../components/pages/IngestionMonitoringPage").then((m) => ({ default: m.IngestionMonitoringPage }))
);
const PipelineMonitoringPage = lazy(() =>
  import("../components/pages/PipelineMonitoringPage").then((m) => ({ default: m.PipelineMonitoringPage }))
);
const LambdaMonitoringPage = lazy(() =>
  import("../components/pages/LambdaMonitoringPage").then((m) => ({ default: m.LambdaMonitoringPage }))
);
const PublicApiPage = lazy(() => import("../components/pages/PublicApiPage").then((m) => ({ default: m.PublicApiPage })));
const CodeQualityPage = lazy(() =>
  import("../components/pages/CodeQualityPage").then((m) => ({ default: m.CodeQualityPage }))
);
const IntegrationTestReportPage = lazy(() =>
  import("../components/pages/IntegrationTestReportPage").then((m) => ({ default: m.IntegrationTestReportPage }))
);
const LoginPage = lazy(() => import("../components/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const AdminPage = lazy(() => import("../components/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const CapacityManagementPage = lazy(() =>
  import("../components/pages/CapacityManagementPage").then((m) => ({ default: m.CapacityManagementPage }))
);
const AdminWarehousePage = lazy(() =>
  import("../components/pages/AdminWarehousePage").then((m) => ({ default: m.AdminWarehousePage }))
);
const FeatureFlagsPage = lazy(() =>
  import("../components/pages/FeatureFlagsPage").then((m) => ({ default: m.FeatureFlagsPage }))
);

const CONTACTS_PAGE_RULE: PageFlagRule = { key: CONTACTS_PAGE_FLAG, onTreatments: [CONTACTS_PAGE_ON] };

export const PAGES: readonly PageRoute[] = [
  { path: RESIDENTS_PATH, tier: "PUBLIC", Page: ResidentsPage },
  { path: CONTACTS_PATH, tier: "PUBLIC", flag: CONTACTS_PAGE_RULE, Page: ContactsPage },
  { path: IDEA_DETAIL_PATTERN, tier: "PUBLIC", Page: ResidentIdeaPage },
  { path: TEAM_PATH, tier: "PUBLIC", Page: TeamPage },
  { path: TEAM_CHAT_PATH, tier: "PUBLIC", Page: TeamChatPage },
  { path: DATA_PATH, tier: "PUBLIC", Page: DataPage },
  { path: MONITORING_PATH, tier: "PUBLIC", Page: MonitoringPage },
  { path: MONITORING_INGESTION_PATH, tier: "PUBLIC", Page: IngestionMonitoringPage },
  { path: MONITORING_PIPELINE_PATH, tier: "PUBLIC", Page: PipelineMonitoringPage },
  { path: MONITORING_LAMBDA_HEALTH_PATH, tier: "PUBLIC", Page: LambdaMonitoringPage },
  { path: MONITORING_PUBLIC_API_PATH, tier: "PUBLIC", Page: PublicApiPage },
  { path: MONITORING_CODE_QUALITY_PATH, tier: "PUBLIC", Page: CodeQualityPage },
  { path: MONITORING_INTEGRATION_TESTS_PATH, tier: "PUBLIC", Page: IntegrationTestReportPage },
  { path: LOGIN_PATH, tier: "PUBLIC", Page: LoginPage },
  { path: ADMIN_PATH, tier: "ADMIN", Page: AdminPage },
  { path: ADMIN_CAPACITY_PATH, tier: "ADMIN", Page: CapacityManagementPage },
  { path: ADMIN_WAREHOUSE_PATH, tier: "ADMIN", Page: AdminWarehousePage },
  { path: ADMIN_FEATURE_FLAGS_PATH, tier: "ADMIN", Page: FeatureFlagsPage },
];
