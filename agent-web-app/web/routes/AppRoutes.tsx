import { Route, Routes } from "react-router-dom";
import { Layout } from "../components/Layout.tsx";
import { AgentPage } from "../components/pages/AgentPage.tsx";
import { DashboardPage } from "../components/pages/DashboardPage.tsx";
import { NotFoundPage } from "../components/pages/NotFoundPage.tsx";
import { PixelOfficePage } from "../components/pages/PixelOfficePage.tsx";
import { RunPage } from "../components/pages/RunPage.tsx";
import { WorktreesPage } from "../components/pages/WorktreesPage.tsx";

/** All routes. No access guards: the app is localhost-only with no auth (CLAUDE.md §5.5). */
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="agents/:agent" element={<AgentPage />} />
        <Route path="agents/:agent/runs/:runId" element={<RunPage />} />
        <Route path="office" element={<PixelOfficePage />} />
        <Route path="worktrees" element={<WorktreesPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
