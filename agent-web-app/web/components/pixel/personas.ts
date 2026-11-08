import type { RoomDraw } from "./pixelKit.ts";
import { drawBroganForge } from "./rooms/broganForge.ts";
import { drawCelestineSanctum } from "./rooms/celestineSanctum.ts";
import { drawGrimbleBridge } from "./rooms/grimbleBridge.ts";
import { drawKestrelRooftop } from "./rooms/kestrelRooftop.ts";
import { drawPennyOffice } from "./rooms/pennyOffice.ts";
import { drawPipWorkshop } from "./rooms/pipWorkshop.ts";
import { drawRexHangar } from "./rooms/rexHangar.ts";
import { drawRobotCloset } from "./rooms/robotCloset.ts";
import { drawSableOffice } from "./rooms/sableOffice.ts";

/** Who works in each room. Fixed content copied from the team roster (docs/17-executive-team.md §2), never imported from web-app/. */
export interface Persona {
  name: string;
  title: string;
  room: string;
  draw: RoomDraw;
}

const PERSONAS: Record<string, Persona> = {
  "chief-of-staff-agent": { name: "Penny Platen", title: "Chief of Staff", room: "The 1950s Office", draw: drawPennyOffice },
  "coo-agent": { name: "Brogan Anvilhand", title: "COO", room: "The Deep Forge", draw: drawBroganForge },
  "cpo-agent": { name: "Celestine Vey", title: "CPO", room: "The Sanctum", draw: drawCelestineSanctum },
  "cto-agent": { name: "Rex Rivet", title: "CTO", room: "Hangar Bay 3", draw: drawRexHangar },
  "devx-agent": { name: "Pip Sprocketwhistle", title: "DevX Engineer", room: "The Workshop", draw: drawPipWorkshop },
  "gen-purpose-dev": { name: "Kid Kestrel", title: "Software Engineer", room: "The Rooftop", draw: drawKestrelRooftop },
  "aws-cost-agent": { name: "Grimble Tollbridge", title: "Cost Engineer", room: "Under the Toll Bridge", draw: drawGrimbleBridge },
  "software-analyzer-agent": { name: "Sable Marsh", title: "Software Analyzer", room: "Marsh Investigations", draw: drawSableOffice },
};

/** The agent's persona, or a stand-in robot in the server closet for an agent the roster doesn't know yet. */
export function personaFor(agent: string): Persona {
  return PERSONAS[agent] ?? { name: agent, title: "Agent", room: "The Server Closet", draw: drawRobotCloset };
}

/** Roster order, so the office reads like the org chart: the executives, then the engineers. */
export const ROSTER_ORDER = Object.keys(PERSONAS);
