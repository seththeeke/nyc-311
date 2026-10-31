import { lazy, Suspense, type ReactElement } from "react";
import { HomePage } from "../components/pages/HomePage";
import { PublicRoute } from "./PublicRoute";
import { ShellRoute } from "./ShellRoute";
import { AdminRoute } from "./AdminRoute";
import { FeatureFlagRoute } from "./FeatureFlagRoute";
import { Navigate, Route, Routes } from "react-router-dom";
import { MAP_V2_FLAG, MAP_V2_ON, MAP_V2_TAKEOVER } from "../models/featureTreatment";
import { MapV2TakeoverRoute } from "./MapV2TakeoverRoute";
import { MAP_V2_PATH } from "../components/mapv2/mapV2Routes";
import { IDEA_DETAIL_PATTERN, RESIDENTS_PATH } from "../components/residents/residentRoutes";
import { SpinnerIcon } from "../components/icons";

/*
 * Every non-landing page is dynamic-imported so Vite/Rollup emits it as its
 * own chunk instead of folding all 14 pages (SQL console, charts, diagrams
 * included) into one bundle — `npm run build` flagged that bundle at 802 kB
 * minified. HomePage stays eager since it's the default route.
 */
const DataPage = lazy(() => import("../components/pages/DataPage").then((m) => ({ default: m.DataPage })));
const MonitoringPage = lazy(() =>
  import("../components/pages/MonitoringPage").then((m) => ({ default: m.MonitoringPage }))
);
const IngestionMonitoringPage = lazy(() =>
  import("../components/pages/IngestionMonitoringPage").then((m) => ({ default: m.IngestionMonitoringPage }))
);
const PipelineMonitoringPage = lazy(() =>
  import("../components/pages/PipelineMonitoringPage").then((m) => ({ default: m.PipelineMonitoringPage }))
);
const LambdaMonitoringPage = lazy(() =>
  import("../components/pages/LambdaMonitoringPage").then((m) => ({ default: m.LambdaMonitoringPage }))
);
const PublicApiPage = lazy(() =>
  import("../components/pages/PublicApiPage").then((m) => ({ default: m.PublicApiPage }))
);
const IntegrationTestReportPage = lazy(() =>
  import("../components/pages/IntegrationTestReportPage").then((m) => ({ default: m.IntegrationTestReportPage }))
);
/* Mapv2 pulls in MapLibre and Three.js. One `/*` route, not one per path, so diving into a job never remounts the city behind it. */
const MapV2Page = lazy(() => import("../components/pages/MapV2Page").then((m) => ({ default: m.MapV2Page })));
const ResidentsPage = lazy(() =>
  import("../components/pages/ResidentsPage").then((m) => ({ default: m.ResidentsPage }))
);
const ResidentIdeaPage = lazy(() =>
  import("../components/pages/ResidentIdeaPage").then((m) => ({ default: m.ResidentIdeaPage }))
);
const LoginPage = lazy(() => import("../components/pages/LoginPage").then((m) => ({ default: m.LoginPage })));
const AdminPage = lazy(() => import("../components/pages/AdminPage").then((m) => ({ default: m.AdminPage })));
const CapacityManagementPage = lazy(() =>
  import("../components/pages/CapacityManagementPage").then((m) => ({ default: m.CapacityManagementPage }))
);
const SchedulingManagementPage = lazy(() =>
  import("../components/pages/SchedulingManagementPage").then((m) => ({ default: m.SchedulingManagementPage }))
);
const AdminWarehousePage = lazy(() =>
  import("../components/pages/AdminWarehousePage").then((m) => ({ default: m.AdminWarehousePage }))
);
const FeatureFlagsPage = lazy(() =>
  import("../components/pages/FeatureFlagsPage").then((m) => ({ default: m.FeatureFlagsPage }))
);

/** Suspense fallback shown in the primary workspace while a lazy page chunk loads. */
function PageLoadingFallback(): ReactElement {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div role="status" className="flex items-center gap-3 text-lg font-medium text-fg-muted">
        <SpinnerIcon className="h-6 w-6" />
        Loading…
      </div>
    </div>
  );
}

/* Every lazy page below repeats this same wrap — one helper instead of 16 copies of it. */
function withLoadingFallback(page: ReactElement): ReactElement {
  return <Suspense fallback={<PageLoadingFallback />}>{page}</Suspense>;
}

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<ShellRoute />}>
        <Route
          path="/"
          element={
            <PublicRoute>
              <MapV2TakeoverRoute classic={<HomePage />} takeover={<Navigate to={MAP_V2_PATH} replace />} />
            </PublicRoute>
          }
        />
        <Route
          path="/about"
          element={
            <PublicRoute>
              <MapV2TakeoverRoute classic={<HomePage />} takeover={withLoadingFallback(<MapV2Page />)} />
            </PublicRoute>
          }
        />
        <Route
          path={`${MAP_V2_PATH}/*`}
          element={
            <FeatureFlagRoute flagKey={MAP_V2_FLAG} onTreatments={[MAP_V2_ON, MAP_V2_TAKEOVER]}>
              {withLoadingFallback(<MapV2Page />)}
            </FeatureFlagRoute>
          }
        />
        <Route path={RESIDENTS_PATH} element={withLoadingFallback(<ResidentsPage />)} />
        <Route path={IDEA_DETAIL_PATTERN} element={withLoadingFallback(<ResidentIdeaPage />)} />
        <Route path="/data" element={<PublicRoute>{withLoadingFallback(<DataPage />)}</PublicRoute>} />
        <Route path="/monitoring" element={<PublicRoute>{withLoadingFallback(<MonitoringPage />)}</PublicRoute>} />
        <Route
          path="/monitoring/ingestion"
          element={<PublicRoute>{withLoadingFallback(<IngestionMonitoringPage />)}</PublicRoute>}
        />
        <Route
          path="/monitoring/pipeline"
          element={<PublicRoute>{withLoadingFallback(<PipelineMonitoringPage />)}</PublicRoute>}
        />
        <Route
          path="/monitoring/lambda-health"
          element={<PublicRoute>{withLoadingFallback(<LambdaMonitoringPage />)}</PublicRoute>}
        />
        <Route
          path="/monitoring/public-api"
          element={<PublicRoute>{withLoadingFallback(<PublicApiPage />)}</PublicRoute>}
        />
        <Route
          path="/monitoring/integration-tests"
          element={<PublicRoute>{withLoadingFallback(<IntegrationTestReportPage />)}</PublicRoute>}
        />
        <Route path="/login" element={<PublicRoute>{withLoadingFallback(<LoginPage />)}</PublicRoute>} />
        <Route path="/admin" element={<AdminRoute>{withLoadingFallback(<AdminPage />)}</AdminRoute>} />
        <Route
          path="/admin/capacity"
          element={<AdminRoute>{withLoadingFallback(<CapacityManagementPage />)}</AdminRoute>}
        />
        <Route
          path="/admin/scheduling"
          element={<AdminRoute>{withLoadingFallback(<SchedulingManagementPage />)}</AdminRoute>}
        />
        <Route
          path="/admin/warehouse"
          element={<AdminRoute>{withLoadingFallback(<AdminWarehousePage />)}</AdminRoute>}
        />
        <Route
          path="/admin/feature-flags"
          element={<AdminRoute>{withLoadingFallback(<FeatureFlagsPage />)}</AdminRoute>}
        />
      </Route>
    </Routes>
  );
}
