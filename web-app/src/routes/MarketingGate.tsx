import { lazy, Suspense, useState, type ReactElement } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useFeatureTreatment } from "../hooks/useFeatureTreatment";
import { MARKETING_PAGE_FLAG, MARKETING_PAGE_ON } from "../models/featureTreatment";
import { MAP_PATH } from "../components/map/mapRoutes";

const MarketingPage = lazy(() => import("../components/pages/MarketingPage").then((m) => ({ default: m.MarketingPage })));

/* Once a visitor enters the fleet, / is the map for the rest of the tab's session, so the map's own links home keep working. */
export const MARKETING_ENTERED_KEY = "nyc311.marketing.entered";

function readEntered(): boolean {
  try {
    return window.sessionStorage.getItem(MARKETING_ENTERED_KEY) === "1";
  } catch {
    return false;
  }
}

function writeEntered(): void {
  try {
    window.sessionStorage.setItem(MARKETING_ENTERED_KEY, "1");
  } catch {
    /* Storage blocked: entering still works for this render, it just isn't remembered. */
  }
}

/*
 * The marketing tier (MARKETING_PAGE): on T1, a first visit to / gets the
 * full-screen marketing page instead of the shell; Enter fleet drops the
 * visitor onto the map. Every other path, and every other treatment, passes
 * straight through to the shell.
 */
export function MarketingGate(): ReactElement | null {
  const { pathname } = useLocation();
  const { treatment, isLoading } = useFeatureTreatment(MARKETING_PAGE_FLAG);
  const [entered, setEntered] = useState(readEntered);
  if (pathname !== MAP_PATH || entered) return <Outlet />;
  if (isLoading) return null;
  if (treatment !== MARKETING_PAGE_ON) return <Outlet />;
  const enter = (): void => {
    writeEntered();
    setEntered(true);
  };
  return (
    <Suspense fallback={null}>
      <MarketingPage onEnter={enter} />
    </Suspense>
  );
}
