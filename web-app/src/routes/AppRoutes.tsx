import { lazy, Suspense, type ReactElement } from "react";
import { PublicRoute } from "./PublicRoute";
import { ShellRoute } from "./ShellRoute";
import { AdminRoute } from "./AdminRoute";
import { FeatureFlagRoute } from "./FeatureFlagRoute";
import { MarketingGate } from "./MarketingGate";
import { Navigate, Route, Routes } from "react-router-dom";
import { MAP_JOB_PATTERN, MAP_PATH } from "../components/map/mapRoutes";
import { CONTACTS_PATH, LEGACY_CONTACTS_PATH } from "../components/contacts/contactRoutes";
import { SpinnerIcon } from "../components/icons";
import { ABOUT_PATH } from "./pagePaths";
import { PAGES, type PageRoute } from "./pageTable";

/* The map pulls in MapLibre and Three.js. Its paths share one layout route, so diving into a job never remounts the city behind it. */
const MapPage = lazy(() => import("../components/pages/MapPage").then((m) => ({ default: m.MapPage })));

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

/* Every lazy page repeats this same wrap — one helper instead of a copy per route. */
function withLoadingFallback(page: ReactElement): ReactElement {
  return <Suspense fallback={<PageLoadingFallback />}>{page}</Suspense>;
}

/* A page wrapped in its tier's guard: AdminRoute, or PublicRoute (plus FeatureFlagRoute when flagged). */
function guardedPage({ tier, flag, Page }: PageRoute): ReactElement {
  const page = withLoadingFallback(<Page />);
  if (tier === "ADMIN") return <AdminRoute>{page}</AdminRoute>;
  if (!flag) return <PublicRoute>{page}</PublicRoute>;
  return (
    <PublicRoute>
      <FeatureFlagRoute flagKey={flag.key} onTreatments={flag.onTreatments}>
        {page}
      </FeatureFlagRoute>
    </PublicRoute>
  );
}

export function AppRoutes(): ReactElement {
  return (
    <Routes>
      <Route element={<MarketingGate />}>
        <Route element={<ShellRoute />}>
          <Route
            element={<PublicRoute>{withLoadingFallback(<MapPage />)}</PublicRoute>}
          >
            <Route path={MAP_PATH} />
            {/* The About drawer lives in the sidebar footer; the map renders underneath. */}
            <Route path={ABOUT_PATH} />
            <Route path={MAP_JOB_PATTERN} />
          </Route>
          {/* The map's old path, kept so bookmarks still land on it. */}
          <Route path="/mapv2/*" element={<Navigate to={MAP_PATH} replace />} />
          {/* Contacts' old path as a Residents tab, kept so bookmarks still land on it. */}
          <Route path={LEGACY_CONTACTS_PATH} element={<Navigate to={CONTACTS_PATH} replace />} />
          {PAGES.map((page) => (
            <Route key={page.path} path={page.path} element={guardedPage(page)} />
          ))}
        </Route>
      </Route>
    </Routes>
  );
}
