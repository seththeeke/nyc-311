import { useEffect, useState, type ReactElement } from "react";
import type { BrowseWebsiteAction } from "../../models/customerIdea";
import { clockTime } from "./customerFormat";

/* How long the mock player dwells on each step while playing. */
export const STEP_PLAYBACK_MS = 1500;

type Recording = BrowseWebsiteAction["recording"];

/**
 * The RPA session behind a "Browsed the website" action. Plays the real
 * recording once one exists; until then it plays the session's step log,
 * one step at a time, in a stand-in for the video frame.
 */
export function RecordingPlayer({ recording }: { recording: Recording }): ReactElement {
  const [stepIndex, setStepIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = recording.steps.length - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setStepIndex((index) => {
        if (index >= last) {
          setPlaying(false);
          return index;
        }
        return index + 1;
      });
    }, STEP_PLAYBACK_MS);
    return () => clearInterval(timer);
  }, [playing, last]);

  if (recording.video_url) {
    return (
      <video controls src={recording.video_url} className="w-full rounded-lg border border-line" aria-label="Session recording">
        <track kind="captions" src={recording.captions_url ?? undefined} label="Steps" default />
      </video>
    );
  }

  const step = recording.steps[stepIndex];
  const togglePlay = (): void => {
    if (!playing && stepIndex >= last) setStepIndex(0);
    setPlaying(!playing);
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="flex items-center gap-1.5 border-b border-line bg-panel-strong px-3 py-2" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-fg-subtle/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-fg-subtle/40" />
        <span className="h-2.5 w-2.5 rounded-full bg-fg-subtle/40" />
        <span className="ml-3 truncate text-[11px] text-fg-subtle">boroughsim.com</span>
      </div>
      <div className="flex aspect-video flex-col items-center justify-center gap-2 bg-panel-sunken p-6 text-center">
        <span className="text-xs text-fg-subtle">Recording not captured yet — replaying the session&apos;s steps</span>
        <p aria-live="polite" className="text-base text-fg">
          {step.description}
        </p>
        <span className="text-xs tabular-nums text-fg-subtle">
          {clockTime(step.at_seconds)} / {clockTime(recording.duration_seconds)}
        </span>
      </div>
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <button type="button" onClick={togglePlay} className="rounded-md px-2 py-1 text-xs font-medium text-fg-muted ring-1 ring-line hover:text-fg">
          {playing ? "Pause" : "Play"}
        </button>
        <ol aria-label="Recording steps" className="flex flex-1 gap-1">
          {recording.steps.map((candidate, index) => (
            <li key={candidate.at_seconds} className="flex-1">
              <button
                type="button"
                aria-label={`Jump to ${clockTime(candidate.at_seconds)}: ${candidate.description}`}
                aria-current={index === stepIndex ? "step" : undefined}
                onClick={() => setStepIndex(index)}
                className={`block h-1.5 w-full rounded-full ${index <= stepIndex ? "bg-fg-muted" : "bg-panel-strong"}`}
              />
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
