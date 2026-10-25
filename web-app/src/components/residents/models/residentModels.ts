import { buildAilanthus } from "./ailanthus";
import { buildDogwood } from "./dogwood";
import { buildGinkgo } from "./ginkgo";
import { buildHawthorn } from "./hawthorn";
import { buildHornbeam } from "./hornbeam";
import { buildJuniper } from "./juniper";
import { buildPineterParker } from "./pineterParker";
import type { ResidentRig } from "./residentFigure";
import { buildSassafras } from "./sassafras";
import { buildSycamore } from "./sycamore";
import { buildYellowwood } from "./yellowwood";

/*
 * Every resident model, by the `model_key` on the resident
 * (13-customer-simulation.md §2 customer side, decision 3). A new
 * resident's model file is added here; an unknown key has no model, and
 * the avatar falls back to the initial.
 */
export const RESIDENT_MODELS: Readonly<Record<string, () => ResidentRig>> = {
  ailanthus: buildAilanthus,
  dogwood: buildDogwood,
  ginkgo: buildGinkgo,
  hawthorn: buildHawthorn,
  hornbeam: buildHornbeam,
  juniper: buildJuniper,
  "pineter-parker": buildPineterParker,
  sassafras: buildSassafras,
  sycamore: buildSycamore,
  yellowwood: buildYellowwood,
};

export function buildResidentModel(modelKey: string | null): ResidentRig | null {
  const build = modelKey ? RESIDENT_MODELS[modelKey] : undefined;
  return build ? build() : null;
}
