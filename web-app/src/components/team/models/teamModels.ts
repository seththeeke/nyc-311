import type { ResidentRig } from "../../residents/models/residentFigure";
import { buildDeeVarick } from "./deeVarick";
import { buildDexMercer } from "./dexMercer";
import { buildHalPearl } from "./halPearl";
import { buildJenGreene } from "./jenGreene";
import { buildJuneBleecker } from "./juneBleecker";
import { buildPriyaLafayette } from "./priyaLafayette";
import { buildTheoHudson } from "./theoHudson";

/* Every executive team model, by the `model_key` on the roster (#146). The resident avatar and stage look keys up here too. */
export const TEAM_MODELS: Readonly<Record<string, () => ResidentRig>> = {
  "june-bleecker": buildJuneBleecker,
  "dee-varick": buildDeeVarick,
  "priya-lafayette": buildPriyaLafayette,
  "hal-pearl": buildHalPearl,
  "theo-hudson": buildTheoHudson,
  "dex-mercer": buildDexMercer,
  "jen-greene": buildJenGreene,
};
