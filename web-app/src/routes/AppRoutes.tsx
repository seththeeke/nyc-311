import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "../components/pages/HomePage";
import { MonitoringPage } from "../components/pages/MonitoringPage";
import { IngestionMonitoringPage } from "../components/pages/IngestionMonitoringPage";
import { PipelineMonitoringPage } from "../components/pages/PipelineMonitoringPage";
import { OrderMonitoringPage } from "../components/pages/OrderMonitoringPage";
import { LambdaMonitoringPage } from "../components/pages/LambdaMonitoringPage";
import { IntegrationTestReportPage } from "../components/pages/IntegrationTestReportPage";
import { PublicRoute } from "./PublicRoute";

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
        path="/monitoring/orders"
        element={
          <PublicRoute>
            <OrderMonitoringPage />
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
    </Routes>
  );
}
