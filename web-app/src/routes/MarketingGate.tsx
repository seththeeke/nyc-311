import { lazy, Suspense, type ReactElement } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useFeatureTreatment } from "../hooks/useFeatureTreatment";
import { useMarketingEntry } from "../hooks/useMarketingEntry";
import {
  MARKETING_PAGE_FLAG,
  MARKETING_PAGE_ON,
  MARKETING_STICKY_ENTRY_FLAG,
  MARKETING_STICKY_ENTRY_ON,
} from "../models/featureTreatment";
import { MAP_PATH } from "../components/map/mapRoutes";

const loadMarketingPage = () => import("../components/pages/MarketingPage");
const MarketingPage = lazy(() => loadMarketingPage().then((m) => ({ default: m.MarketingPage })));

/*
 * The marketing tier (MARKETING_PAGE): on T1, a visitor who hasn't entered
 * gets the full-screen marketing page at / instead of the shell; Enter fleet
 * drops them onto the map. MARKETING_STICKY_ENTRY decides how long entering
 * is remembered (marketingEntry.ts): C for the tab, T1 for 7 days since the
 * last visit. Every other path, and every other treatment, passes straight
 * through to the shell.
 */
export function MarketingGate(): ReactElement | null {
  const { pathname } = useLocation();
  const marketing = useFeatureTreatment(MARKETING_PAGE_FLAG);
  const sticky = useFeatureTreatment(MARKETING_STICKY_ENTRY_FLAG);
  const { entered, enter } = useMarketingEntry(sticky.treatment === MARKETING_STICKY_ENTRY_ON);
  if (pathname !== MAP_PATH || entered) return <Outlet />;
  /* Fetch the page's code alongside the flag lookups, not after them: on T1 that's one round trip off first paint. */
  if (marketing.isLoading || sticky.isLoading) {
    void loadMarketingPage();
    return null;
  }
  if (marketing.treatment !== MARKETING_PAGE_ON) return <Outlet />;
  return (
    <Suspense fallback={null}>
      <MarketingPage onEnter={enter} />
    </Suspense>
  );
}
