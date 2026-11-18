import type { ReactElement } from "react";
import { useNavigate } from "react-router-dom";
import { useFeatureEnabled } from "../../hooks/useFeatureTreatment";
import {
  MARKETING_PAGE_FLAG,
  MARKETING_PAGE_ON,
  MARKETING_STICKY_ENTRY_FLAG,
  MARKETING_STICKY_ENTRY_ON,
} from "../../models/featureTreatment";
import { clearMarketingEntry } from "../../routes/marketingEntry";

/**
 * The way back to the marketing page (#165): forgets the visitor's entry and
 * goes to /, where MarketingGate shows the page again. Shown only when both
 * MARKETING_PAGE and MARKETING_STICKY_ENTRY are T1.
 */
export function BackToIntroButton(): ReactElement | null {
  const navigate = useNavigate();
  const marketingOn = useFeatureEnabled(MARKETING_PAGE_FLAG, MARKETING_PAGE_ON);
  const stickyOn = useFeatureEnabled(MARKETING_STICKY_ENTRY_FLAG, MARKETING_STICKY_ENTRY_ON);
  if (!marketingOn || !stickyOn) return null;
  const goBack = (): void => {
    clearMarketingEntry();
    navigate("/");
  };
  return (
    <button
      type="button"
      onClick={goBack}
      className="mt-8 rounded-full border border-line bg-panel px-4 py-2 text-sm font-medium text-fg hover:bg-panel-hover"
    >
      Back to the intro
    </button>
  );
}
