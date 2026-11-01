import { config } from "../config";
import { ResidentIdeaDetailSchema, ResidentIdeaPageSchema, type ResidentIdeaDetail, type ResidentIdeaPage } from "../models/residentIdea";
import { ResidentPersonaPageSchema, ResidentPersonaSchema, type ResidentPersona, type ResidentPersonaPage } from "../models/residentPersona";
import { MOCK_IDEA_STEPS, MOCK_RESIDENT_IDEAS } from "../test-data/residentIdeas";
import { MOCK_RESIDENT_PERSONAS } from "../test-data/residentPersonas";

/*
 * The resident read API as the Residents page needs it
 * (13-customer-simulation.md §4, Appendix K) — the contract this mock is
 * here to settle before the API is built. Paginated lists use an opaque
 * cursor. The API is hosted on the customer stack (customer-api.boroughsim.com).
 */
export interface IdeaQuery {
  /** Only this persona's ideas (`GET /residents/{id}/ideas`); omit for every persona's (`GET /ideas`). */
  personaId?: string;
  cursor?: string;
}

export interface ResidentService {
  listPersonas(): Promise<ResidentPersonaPage>;
  getPersona(personaId: string): Promise<ResidentPersona>;
  listIdeas(query?: IdeaQuery): Promise<ResidentIdeaPage>;
  /** One idea, addressed by its resident — `GET /residents/{id}/ideas/{ideaId}`. */
  getIdea(personaId: string, ideaId: string): Promise<ResidentIdeaDetail>;
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${config.residentApiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`Resident API ${path} failed: HTTP ${response.status}`);
  return response.json();
}

function withCursor(path: string, cursor: string | undefined): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

/* Against the resident API on the customer stack. */
class LiveResidentService implements ResidentService {
  async listPersonas(): Promise<ResidentPersonaPage> {
    return ResidentPersonaPageSchema.parse(await getJson("/residents"));
  }

  async getPersona(personaId: string): Promise<ResidentPersona> {
    return ResidentPersonaSchema.parse(await getJson(`/residents/${encodeURIComponent(personaId)}`));
  }

  async listIdeas(query: IdeaQuery = {}): Promise<ResidentIdeaPage> {
    const path = query.personaId ? `/residents/${encodeURIComponent(query.personaId)}/ideas` : "/ideas";
    return ResidentIdeaPageSchema.parse(await getJson(withCursor(path, query.cursor)));
  }

  async getIdea(personaId: string, ideaId: string): Promise<ResidentIdeaDetail> {
    return ResidentIdeaDetailSchema.parse(await getJson(`/residents/${encodeURIComponent(personaId)}/ideas/${encodeURIComponent(ideaId)}`));
  }
}

/* Long enough to see loading states while iterating, short enough not to annoy. */
const MOCK_LATENCY_MS = 250;
/* Smaller than the API's 20, so the 14 sample ideas exercise paging. */
export const MOCK_IDEA_PAGE_SIZE = 10;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

class MockResidentService implements ResidentService {
  async listPersonas(): Promise<ResidentPersonaPage> {
    await delay();
    return { items: MOCK_RESIDENT_PERSONAS.map((persona) => ({ ...persona })), nextCursor: null };
  }

  async getPersona(personaId: string): Promise<ResidentPersona> {
    await delay();
    const persona = MOCK_RESIDENT_PERSONAS.find((candidate) => candidate.persona_id === personaId);
    if (!persona) throw new Error(`Resident API /residents/${personaId} failed: HTTP 404`);
    return { ...persona };
  }

  async listIdeas(query: IdeaQuery = {}): Promise<ResidentIdeaPage> {
    await delay();
    const all = MOCK_RESIDENT_IDEAS.filter((idea) => !query.personaId || idea.persona_id === query.personaId)
      .map((idea) => ({ ...idea }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    /* The mock's cursor is just the offset of the next page. */
    const start = query.cursor ? Number(query.cursor) : 0;
    const end = start + MOCK_IDEA_PAGE_SIZE;
    return { items: all.slice(start, end), nextCursor: end < all.length ? String(end) : null };
  }

  async getIdea(personaId: string, ideaId: string): Promise<ResidentIdeaDetail> {
    await delay();
    const idea = MOCK_RESIDENT_IDEAS.find((candidate) => candidate.persona_id === personaId && candidate.idea_id === ideaId);
    if (!idea) throw new Error(`Resident API /residents/${personaId}/ideas/${ideaId} failed: HTTP 404`);
    return { ...idea, steps: MOCK_IDEA_STEPS[idea.idea_id] ?? [] };
  }
}

/*
 * VITE_RESIDENT_DATA_MODE overrides VITE_DATA_MODE for this service only,
 * so a live-mode dev server (real flags) can still show the mocks. Unset in
 * the pipeline's live build, so the mock and its test-data tree-shake out.
 */
const RESIDENT_DATA_MODE = import.meta.env.VITE_RESIDENT_DATA_MODE || import.meta.env.VITE_DATA_MODE;

export const residentService: ResidentService = RESIDENT_DATA_MODE === "live" ? new LiveResidentService() : new MockResidentService();
