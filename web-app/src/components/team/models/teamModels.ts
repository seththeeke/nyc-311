import type { TeamRig } from "./kit/teamBody";
import { finishRig } from "./kit/teamMotion";
import { buildBroganAnvilhand } from "./brogan/broganAnvilhand";
import { buildCelestineVey } from "./celestine/celestineVey";
import { buildRexRivet } from "./rex/rexRivet";
import { buildPipSprocketwhistle } from "./pip/pipSprocketwhistle";
import { buildKidKestrel } from "./kestrel/kidKestrel";
import { buildPennyPlaten } from "./penny/pennyPlaten";
import { buildGrimbleTollbridge } from "./grimble/grimbleTollbridge";
import { buildSableMarsh } from "./sable/sableMarsh";

/* Every executive team model, by the `model_key` on the roster (#146). The resident avatar and stage look keys up here too. */
export const TEAM_MODELS: Readonly<Record<string, () => TeamRig>> = {
  "penny-platen": () => finishRig(buildPennyPlaten()),
  "brogan-anvilhand": () => finishRig(buildBroganAnvilhand()),
  "celestine-vey": () => finishRig(buildCelestineVey()),
  "rex-rivet": () => finishRig(buildRexRivet()),
  "pip-sprocketwhistle": () => finishRig(buildPipSprocketwhistle()),
  "kid-kestrel": () => finishRig(buildKidKestrel()),
  "grimble-tollbridge": () => finishRig(buildGrimbleTollbridge()),
  "sable-marsh": () => finishRig(buildSableMarsh()),
};

export function isTeamModel(modelKey: string | null): modelKey is string {
  return modelKey !== null && modelKey in TEAM_MODELS;
}
