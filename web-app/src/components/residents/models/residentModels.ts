import { buildHawthorn } from "./hawthorn";
import { buildJuniper } from "./juniper";
import type { ResidentRig } from "./residentFigure";
import { buildSycamore } from "./sycamore";

/*
 * Every resident model, by the `model_key` on the resident
 * (13-customer-simulation.md §2 customer side, decision 3). A new
 * resident's model file is added here; an unknown key has no model, and
 * the avatar falls back to the initial.
 */
export const RESIDENT_MODELS: Readonly<Record<string, () => ResidentRig>> = {
  hawthorn: buildHawthorn,
  juniper: buildJuniper,
  sycamore: buildSycamore,
};

export function buildResidentModel(modelKey: string | null): ResidentRig | null {
  const build = modelKey ? RESIDENT_MODELS[modelKey] : undefined;
  return build ? build() : null;
}
