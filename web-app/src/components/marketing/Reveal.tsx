import { useRef, type ReactElement, type ReactNode } from "react";
import { useInView } from "./useInView";

interface RevealProps {
  children: ReactNode;
  delayMs?: number;
  className?: string;
}

/* Fades and lifts its children in the first time they scroll into view. */
export function Reveal({ children, delayMs = 0, className = "" }: RevealProps): ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref);
  return (
    <div
      ref={ref}
      data-revealed={inView}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-1000 ease-[cubic-bezier(0.2,0.8,0.2,1)] ${inView ? "translate-y-0 opacity-100 blur-0" : "translate-y-10 opacity-0 blur-sm"} ${className}`}
    >
      {children}
    </div>
  );
}
