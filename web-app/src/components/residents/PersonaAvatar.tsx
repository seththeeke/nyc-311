import type { ReactElement } from "react";
import { useResidentAvatar } from "../../hooks/useResidentAvatar";

interface PersonaAvatarProps {
  name: string;
  /** The resident's model (`model_key`); without one, or without WebGL, the initial shows instead. */
  modelKey?: string | null;
  size?: "SM" | "LG";
}

/*
 * A resident's face: a head-and-shoulders snapshot of their Three.js model
 * (13-customer-simulation.md §2 customer side, decision 3) in a neutral
 * circle, or their initial until or unless one can be drawn. Decorative —
 * the surrounding control or text carries the name.
 */
export function PersonaAvatar({ name, modelKey = null, size = "SM" }: PersonaAvatarProps): ReactElement {
  const snapshot = useResidentAvatar(modelKey);
  const sizeClasses = size === "LG" ? "h-12 w-12 text-lg" : "h-8 w-8 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-panel-strong font-semibold text-fg-muted ${sizeClasses}`}
    >
      {snapshot ? <img src={snapshot} alt="" className="h-full w-full object-cover" /> : name.charAt(0)}
    </span>
  );
}
