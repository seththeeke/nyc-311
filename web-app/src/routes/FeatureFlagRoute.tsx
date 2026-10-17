import type { ReactElement } from "react";
import { Navigate } from "react-router-dom";
import { useFeatureTreatment } from "../hooks/useFeatureTreatment";

interface FeatureFlagRouteProps {
  flagKey: string;
  /** The treatments that show the page; any other, a missing flag or a failed lookup sends the visitor home. */
  onTreatments: readonly string[];
  children: ReactElement;
}

/*
 * The flag-gated visibility tier (CLAUDE.md §5.1's one guard per tier):
 * a public page that exists only while its flag says so. Hiding the menu
 * entry is a cue; this is what keeps a typed URL out too.
 */
export function FeatureFlagRoute({ flagKey, onTreatments, children }: FeatureFlagRouteProps): ReactElement | null {
  const { treatment, isLoading } = useFeatureTreatment(flagKey);
  if (isLoading) return null;
  if (!treatment || !onTreatments.includes(treatment)) return <Navigate to="/" replace />;
  return children;
}
