/*
 * The scripted, looping job animation shown in the dive-in. It is
 * illustrative, not live: the API reports only that a crew is working,
 * so every Street Condition job plays the same repair, and anything else
 * plays a generic crew-at-work loop.
 */

export const REPAIR_PHASES = ["ARRIVE", "SECURE", "CUT", "CLEAR", "FILL", "COMPACT", "DONE"] as const;
export const GENERIC_PHASES = ["ARRIVE", "SECURE", "WORK", "DONE"] as const;
export type JobPhase = (typeof REPAIR_PHASES)[number] | (typeof GENERIC_PHASES)[number];

export type JobScript = "STREET_REPAIR" | "GENERIC";

interface PhaseSpec {
  phase: JobPhase;
  label: string;
  seconds: number;
}

const PHASE_LABEL: Record<JobPhase, string> = {
  ARRIVE: "Crew arrives",
  SECURE: "Site coned off",
  CUT: "Saw-cut the damage",
  CLEAR: "Clear debris",
  FILL: "Pour hot asphalt",
  COMPACT: "Roll & compact",
  WORK: "Crew at work",
  DONE: "Site reopened",
};

const PHASE_SECONDS: Record<JobPhase, number> = {
  ARRIVE: 3.5,
  SECURE: 3,
  CUT: 4,
  CLEAR: 3,
  FILL: 4,
  COMPACT: 4.5,
  WORK: 9,
  DONE: 3,
};

export const STREET_CONDITION = "Street Condition";

export function scriptFor(complaintType: string | null): JobScript {
  return complaintType === STREET_CONDITION ? "STREET_REPAIR" : "GENERIC";
}

export function phasesFor(script: JobScript): PhaseSpec[] {
  const phases: readonly JobPhase[] = script === "STREET_REPAIR" ? REPAIR_PHASES : GENERIC_PHASES;
  return phases.map((phase) => ({ phase, label: PHASE_LABEL[phase], seconds: PHASE_SECONDS[phase] }));
}

export function loopSeconds(script: JobScript): number {
  return phasesFor(script).reduce((total, spec) => total + spec.seconds, 0);
}

export interface TimelineState {
  phase: JobPhase;
  index: number;
  /** 0..1 through the current phase. */
  progress: number;
  /** 0..1 through the whole loop. */
  loopProgress: number;
}

/** Where the loop is `elapsedSeconds` in; negative time clamps to the start. */
export function timelineAt(script: JobScript, elapsedSeconds: number): TimelineState {
  const specs = phasesFor(script);
  const total = loopSeconds(script);
  const t = Math.max(0, elapsedSeconds) % total;
  let start = 0;
  for (const [index, spec] of specs.entries()) {
    if (t < start + spec.seconds) {
      return { phase: spec.phase, index, progress: (t - start) / spec.seconds, loopProgress: t / total };
    }
    start += spec.seconds;
  }
  /* Unreachable for t < total; floating-point safety only. */
  /* v8 ignore next */
  return { phase: specs[specs.length - 1].phase, index: specs.length - 1, progress: 1, loopProgress: 1 };
}

/** The phase a reduced-motion viewer sees frozen: mid-repair, where the scene says the most. */
export function representativeSeconds(script: JobScript): number {
  const specs = phasesFor(script);
  const target: JobPhase = script === "STREET_REPAIR" ? "FILL" : "WORK";
  let start = 0;
  for (const spec of specs) {
    if (spec.phase === target) return start + spec.seconds * 0.6;
    start += spec.seconds;
  }
  /* v8 ignore next */
  return 0;
}

/**
 * How far through `phase` the loop is at `elapsedSeconds`: 0 before it, 1
 * after it, and 0 throughout when the script has no such phase. Lets one
 * prop key off any phase, not just the current one.
 */
export function phaseProgress(script: JobScript, elapsedSeconds: number, phase: JobPhase): number {
  const t = Math.max(0, elapsedSeconds) % loopSeconds(script);
  let start = 0;
  for (const spec of phasesFor(script)) {
    if (spec.phase === phase) return Math.min(1, Math.max(0, (t - start) / spec.seconds));
    start += spec.seconds;
  }
  return 0;
}
