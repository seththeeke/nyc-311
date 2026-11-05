import { lazy, Suspense, useState, type ReactElement } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useFeatureTreatment } from "../hooks/useFeatureTreatment";
import { MARKETING_PAGE_FLAG, MARKETING_PAGE_ON } from "../models/featureTreatment";
import { MAP_PATH } from "../components/map/mapRoutes";

const loadMarketingPage = () => import("../components/pages/MarketingPage");
const MarketingPage = lazy(() => loadMarketingPage().then((m) => ({ default: m.MarketingPage })));

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
  /* Fetch the page's code alongside the flag lookup, not after it: on T1 that's one round trip off first paint. */
  if (isLoading) {
    void loadMarketingPage();
    return null;
  }
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
