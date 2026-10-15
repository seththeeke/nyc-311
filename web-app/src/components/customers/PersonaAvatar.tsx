import type { ReactElement } from "react";
import { avatarClasses } from "./customerFormat";

interface PersonaAvatarProps {
  personaId: string;
  name: string;
  size?: "SM" | "LG";
}

/** A persona's initial in its own colour. Decorative — the surrounding control or text carries the name. */
export function PersonaAvatar({ personaId, name, size = "SM" }: PersonaAvatarProps): ReactElement {
  const sizeClasses = size === "LG" ? "h-12 w-12 text-lg" : "h-8 w-8 text-sm";
  return (
    <span aria-hidden="true" className={`inline-flex shrink-0 items-center justify-center rounded-full font-semibold ${sizeClasses} ${avatarClasses(personaId)}`}>
      {name.charAt(0)}
    </span>
  );
}
