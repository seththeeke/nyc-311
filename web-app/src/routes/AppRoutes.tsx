import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "../components/pages/HomePage";
import { DataPage } from "../components/pages/DataPage";
import { MonitoringPage } from "../components/pages/MonitoringPage";
import { IngestionMonitoringPage } from "../components/pages/IngestionMonitoringPage";
import { PipelineMonitoringPage } from "../components/pages/PipelineMonitoringPage";
import { LambdaMonitoringPage } from "../components/pages/LambdaMonitoringPage";
import { IntegrationTestReportPage } from "../components/pages/IntegrationTestReportPage";
import { ReportsPage } from "../components/pages/ReportsPage";
import { LoginPage } from "../components/pages/LoginPage";
import { AdminPage } from "../components/pages/AdminPage";
import { CapacityManagementPage } from "../components/pages/CapacityManagementPage";
import { SchedulingManagementPage } from "../components/pages/SchedulingManagementPage";
import { AdminWarehousePage } from "../components/pages/AdminWarehousePage";
import { PublicRoute } from "./PublicRoute";
import { AdminRoute } from "./AdminRoute";

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route
        path="/"
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
            <DataPage />
          </PublicRoute>
        }
      />
      <Route
        path="/monitoring"
        element={
          <PublicRoute>
            <MonitoringPage />
          </PublicRoute>
        }
      />
      <Route
        path="/monitoring/ingestion"
        element={
          <PublicRoute>
            <IngestionMonitoringPage />
          </PublicRoute>
        }
      />
      <Route
        path="/monitoring/pipeline"
        element={
          <PublicRoute>
            <PipelineMonitoringPage />
          </PublicRoute>
        }
      />
      <Route
        path="/monitoring/lambda-health"
        element={
          <PublicRoute>
            <LambdaMonitoringPage />
          </PublicRoute>
        }
      />
      <Route
        path="/monitoring/integration-tests"
        element={
          <PublicRoute>
            <IntegrationTestReportPage />
          </PublicRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <PublicRoute>
            <ReportsPage />
          </PublicRoute>
        }
      />
      <Route
        path="/login"
        element={
          <PublicRoute>
            <LoginPage />
          </PublicRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/capacity"
        element={
          <AdminRoute>
            <CapacityManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/scheduling"
        element={
          <AdminRoute>
            <SchedulingManagementPage />
          </AdminRoute>
        }
      />
      <Route
        path="/admin/warehouse"
        element={
          <AdminRoute>
            <AdminWarehousePage />
          </AdminRoute>
        }
      />
    </Routes>
  );
}
