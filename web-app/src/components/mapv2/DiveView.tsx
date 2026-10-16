import { type ReactElement, useEffect, useRef } from "react";
import type { FleetOperatorLocation } from "../../models/fleetLocation";
import type { ThemeName } from "../../models/theme";
import { SpinnerIcon } from "../icons";
import { GLASS } from "./hudStyle";
import { JobHud } from "./JobHud";
import { MapV2Glyph } from "./MapV2Glyph";
import { scriptFor } from "./repairTimeline";
import { useDiveRenderer } from "./useDiveRenderer";

interface DiveViewProps {
  /** The Operator on this job, or undefined while loading or once the job is no longer active. */
  operator: FleetOperatorLocation | undefined;
  isLoading: boolean;
  theme: ThemeName;
  reducedMotion: boolean;
  onExit: () => void;
}

function DiveStage({ operator, theme, reducedMotion, onExit }: DiveViewProps & { operator: FleetOperatorLocation }): ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const script = scriptFor(operator.current_order?.complaint_type ?? null);
  const timeline = useDiveRenderer(canvasRef, script, theme, reducedMotion);
  return (
    <>
      <canvas ref={canvasRef} className="h-full w-full" aria-label={`Animated close-up of ${operator.name}'s job`} role="img" />
      <JobHud operator={operator} script={script} timeline={timeline} onExit={onExit} />
    </>
  );
}

/**
 * The dive-in over the city: the job's close-up and its HUD, or a
 * holding/ended card when the job isn't (or is no longer) in the fleet
 * feed. Escape returns to the city from anywhere in it.
 */
export function DiveView(props: DiveViewProps): ReactElement {
  const { operator, isLoading, onExit } = props;
  const onExitRef = useRef(onExit);
  useEffect(() => {
    onExitRef.current = onExit;
  });
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === "Escape") onExitRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="absolute inset-0 z-20 overflow-hidden bg-surface motion-safe:animate-[mapv2-dive-in_700ms_ease-out]">
      {operator ? (
        <DiveStage {...props} operator={operator} />
      ) : (
        <div className="flex h-full items-center justify-center p-4">
          <div role={isLoading ? "status" : "alert"} className={`${GLASS} flex max-w-sm flex-col items-center gap-3 p-6 text-center`}>
            {isLoading ? (
              <>
                <SpinnerIcon className="h-8 w-8" />
                <p className="text-fg">Finding the crew…</p>
              </>
            ) : (
              <>
                <p className="text-lg font-semibold text-fg">This job isn&apos;t active right now</p>
                <p className="text-sm text-fg-muted">The crew may have finished, or the link is from an earlier shift.</p>
                <button type="button" onClick={onExit} className="mt-1 flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-sm font-semibold text-on-accent focus-visible:ring-2 focus-visible:ring-hue-cyan focus-visible:outline-none">
                  <MapV2Glyph name="BACK" /> Back to city
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
