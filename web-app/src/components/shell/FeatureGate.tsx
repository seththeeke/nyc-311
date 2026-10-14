import type { ReactElement, ReactNode } from "react";
import { useFeatureEnabled } from "../../hooks/useFeatureTreatment";

interface FeatureGateProps {
  flagKey: string;
  onTreatment: string;
  children: ReactNode;
}

/** Renders `children` only once the flag resolves to `onTreatment` — hidden while loading, so nothing flashes in and out. */
export function FeatureGate({ flagKey, onTreatment, children }: FeatureGateProps): ReactElement | null {
  return useFeatureEnabled(flagKey, onTreatment) ? <>{children}</> : null;
}
