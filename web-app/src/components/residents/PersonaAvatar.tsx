import type { ReactElement } from "react";

interface PersonaAvatarProps {
  name: string;
  size?: "SM" | "LG";
}

/*
 * A resident's initial in a neutral circle. Stands in for a profile image,
 * which the design reserves (13-customer-simulation.md Appendix K) but
 * the mock does not have yet. Decorative — the surrounding control or text
 * carries the name.
 */
export function PersonaAvatar({ name, size = "SM" }: PersonaAvatarProps): ReactElement {
  const sizeClasses = size === "LG" ? "h-12 w-12 text-lg" : "h-8 w-8 text-sm";
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-panel-strong font-semibold text-fg-muted ${sizeClasses}`}
    >
      {name.charAt(0)}
    </span>
  );
}
