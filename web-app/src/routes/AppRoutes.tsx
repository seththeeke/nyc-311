import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";
import { HomePage } from "../components/pages/HomePage";
import { MonitoringPage } from "../components/pages/MonitoringPage";
import { IngestionMonitoringPage } from "../components/pages/IngestionMonitoringPage";
import { PipelineMonitoringPage } from "../components/pages/PipelineMonitoringPage";
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
    </Routes>
  );
}
