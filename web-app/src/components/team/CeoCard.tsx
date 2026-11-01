import { type ReactElement, useEffect, useRef, useState } from "react";
import type { TeamMember } from "../../models/teamMember";
import { useInView } from "./useInView";

/**
 * The human CEO (#146): a thinner card than the agents', with a photo,
 * a tagline and links out. It sticks to the top of the page, shrinking to
 * a compact bar once the reader scrolls past where it sits. The height it
 * loses comes back as a bottom margin, so the page below doesn't move; a
 * moving page would pull the sentinel back into view and the card would
 * flicker between sizes.
 */
export function CeoCard({ member }: { member: TeamMember }): ReactElement {
  const sentinel = useRef<HTMLDivElement>(null);
  const { inView, seen } = useInView(sentinel, 0);
  const compact = seen && !inView;
  const card = useRef<HTMLElement>(null);
  const fullHeight = useRef(0);
  const compactRef = useRef(compact);
  compactRef.current = compact;
  const [give, setGive] = useState(0);
  useEffect(() => {
    const element = card.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    /* Tracks the card through its size animation, so the page height holds steady the whole way. */
    const observer = new ResizeObserver(() => {
      const height = element.offsetHeight;
      if (!compactRef.current && height >= fullHeight.current) fullHeight.current = height;
      setGive(Math.max(0, fullHeight.current - height));
    });
    observer.observe(element);
    /* A narrower window can make the full card shorter: start the measure over. */
    const remeasure = (): void => {
      if (!compactRef.current) fullHeight.current = element.offsetHeight;
    };
    window.addEventListener("resize", remeasure);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", remeasure);
    };
  }, []);

  return (
    <>
      <div ref={sentinel} aria-hidden="true" className="mt-6 h-px" />
      <section
        ref={card}
        aria-label={member.title}
        style={{ marginBottom: give }}
        className={`sticky top-2 z-10 flex items-center gap-4 rounded-3xl border border-line bg-panel/95 shadow-sm backdrop-blur transition-all duration-300 motion-reduce:transition-none ${
          compact ? "py-2 pr-14 pl-4" : "px-6 py-5"
        }`}
      >
        {member.photo_url && (
          <img
            src={member.photo_url}
            alt={member.name}
            className={`shrink-0 rounded-full object-cover transition-all duration-300 motion-reduce:transition-none ${compact ? "size-9" : "size-20"}`}
          />
        )}
        <div className="min-w-0 flex-1">
          <h2 className={`font-semibold tracking-tight text-fg transition-all duration-300 motion-reduce:transition-none ${compact ? "text-base" : "text-2xl"}`}>
            {member.title}
            {compact && <span className="ml-2 text-sm font-normal text-fg-muted">{member.name}</span>}
          </h2>
          {!compact && (
            <>
              <p className="text-sm text-fg-muted">{member.name}</p>
              <p className="mt-1 text-sm italic text-fg">{member.responsibility}</p>
            </>
          )}
        </div>
        <nav aria-label={`${member.name} elsewhere`} className="flex shrink-0 gap-2">
          {member.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className={`rounded-lg border border-line font-medium text-fg hover:bg-panel-hover ${compact ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm"}`}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </section>
    </>
  );
}
