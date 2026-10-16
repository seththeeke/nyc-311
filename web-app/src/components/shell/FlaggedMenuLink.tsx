import type { ReactElement } from "react";
import { useFeatureTreatment } from "../../hooks/useFeatureTreatment";
import { type MenuFlagRule, type MenuLinkEntry, resolveFlaggedLink } from "./menuConfig";

interface FlaggedMenuLinkProps {
  entry: MenuLinkEntry & { featureFlag: MenuFlagRule };
  render: (entry: MenuLinkEntry) => ReactElement;
}

/** A menu link shaped by its flag — shown, hidden or relabelled per `resolveFlaggedLink`. */
export function FlaggedMenuLink({ entry, render }: FlaggedMenuLinkProps): ReactElement | null {
  const { treatment } = useFeatureTreatment(entry.featureFlag.key);
  const resolved = resolveFlaggedLink(entry, treatment);
  return resolved ? <li>{render(resolved)}</li> : null;
}
