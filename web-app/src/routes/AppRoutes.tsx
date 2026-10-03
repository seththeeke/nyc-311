import { lazy, Suspense, type ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "../components/pages/HomePage";
import { PublicRoute } from "./PublicRoute";
import { ShellRoute } from "./ShellRoute";
import { AdminRoute } from "./AdminRoute";
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
const IntegrationTestReportPage = lazy(() =>
  import("../components/pages/IntegrationTestReportPage").then((m) => ({ default: m.IntegrationTestReportPage }))
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

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<ShellRoute />}>
        <Route
          path="/"
          element={
            <PublicRoute>
              <HomePage />
            </PublicRoute>
          }
        />
        <Route
          path="/about"
          element={
            <PublicRoute>
              <HomePage />
            </PublicRoute>
          }
        />
        <Route
          path="/data"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <DataPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <MonitoringPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/monitoring/ingestion"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <IngestionMonitoringPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/monitoring/pipeline"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <PipelineMonitoringPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/monitoring/lambda-health"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <LambdaMonitoringPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/monitoring/integration-tests"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <IntegrationTestReportPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <LoginPage />
              </Suspense>
            </PublicRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <AdminPage />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/capacity"
          element={
            <AdminRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <CapacityManagementPage />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/scheduling"
          element={
            <AdminRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <SchedulingManagementPage />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/warehouse"
          element={
            <AdminRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <AdminWarehousePage />
              </Suspense>
            </AdminRoute>
          }
        />
        <Route
          path="/admin/feature-flags"
          element={
            <AdminRoute>
              <Suspense fallback={<PageLoadingFallback />}>
                <FeatureFlagsPage />
              </Suspense>
            </AdminRoute>
          }
        />
      </Route>
    </Routes>
  );
}
