import { config } from "../config";
import { CustomerIdeaPageSchema, CustomerIdeaSchema, type CustomerIdea, type CustomerIdeaPage } from "../models/customerIdea";
import { CustomerPersonaPageSchema, CustomerPersonaSchema, type CustomerPersona, type CustomerPersonaPage } from "../models/customerPersona";
import { MOCK_CUSTOMER_IDEAS } from "../test-data/customerIdeas";
import { MOCK_CUSTOMER_PERSONAS } from "../test-data/customerPersonas";

/*
 * The resident read API as the Residents page needs it
 * (13-customer-simulation.md §4, Appendix K) — the contract this mock is
 * here to settle before the API is built. Paginated lists use an opaque
 * cursor. Route names still say "customers", as the API was first sketched.
 */
export interface IdeaQuery {
  /** Only this persona's ideas (`GET /customers/{id}/ideas`); omit for every persona's (`GET /ideas`). */
  personaId?: string;
  cursor?: string;
}

export interface CustomerService {
  listPersonas(): Promise<CustomerPersonaPage>;
  getPersona(personaId: string): Promise<CustomerPersona>;
  listIdeas(query?: IdeaQuery): Promise<CustomerIdeaPage>;
  /** One idea, addressed by its resident — `GET /customers/{id}/ideas/{ideaId}`. */
  getIdea(personaId: string, ideaId: string): Promise<CustomerIdea>;
}

async function getJson(path: string): Promise<unknown> {
  const response = await fetch(`${config.customerApiBaseUrl}${path}`);
  if (!response.ok) throw new Error(`Customer API ${path} failed: HTTP ${response.status}`);
  return response.json();
}

function withCursor(path: string, cursor: string | undefined): string {
  return cursor ? `${path}?cursor=${encodeURIComponent(cursor)}` : path;
}

/* Against the resident API — not built yet, so in a live build the page shows its error state. */
class LiveCustomerService implements CustomerService {
  async listPersonas(): Promise<CustomerPersonaPage> {
    return CustomerPersonaPageSchema.parse(await getJson("/customers"));
  }

  async getPersona(personaId: string): Promise<CustomerPersona> {
    return CustomerPersonaSchema.parse(await getJson(`/customers/${encodeURIComponent(personaId)}`));
  }

  async listIdeas(query: IdeaQuery = {}): Promise<CustomerIdeaPage> {
    const path = query.personaId ? `/customers/${encodeURIComponent(query.personaId)}/ideas` : "/ideas";
    return CustomerIdeaPageSchema.parse(await getJson(withCursor(path, query.cursor)));
  }

  async getIdea(personaId: string, ideaId: string): Promise<CustomerIdea> {
    return CustomerIdeaSchema.parse(await getJson(`/customers/${encodeURIComponent(personaId)}/ideas/${encodeURIComponent(ideaId)}`));
  }
}

/* Long enough to see loading states while iterating, short enough not to annoy. */
const MOCK_LATENCY_MS = 250;

function delay(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, MOCK_LATENCY_MS));
}

class MockCustomerService implements CustomerService {
  async listPersonas(): Promise<CustomerPersonaPage> {
    await delay();
    return { items: MOCK_CUSTOMER_PERSONAS.map((persona) => ({ ...persona })), nextCursor: null };
  }

  async getPersona(personaId: string): Promise<CustomerPersona> {
    await delay();
    const persona = MOCK_CUSTOMER_PERSONAS.find((candidate) => candidate.persona_id === personaId);
    if (!persona) throw new Error(`Customer API /customers/${personaId} failed: HTTP 404`);
    return { ...persona };
  }

  async listIdeas(query: IdeaQuery = {}): Promise<CustomerIdeaPage> {
    await delay();
    const items = MOCK_CUSTOMER_IDEAS.filter((idea) => !query.personaId || idea.persona_id === query.personaId)
      .map((idea) => ({ ...idea }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    return { items, nextCursor: null };
  }

  async getIdea(personaId: string, ideaId: string): Promise<CustomerIdea> {
    await delay();
    const idea = MOCK_CUSTOMER_IDEAS.find((candidate) => candidate.persona_id === personaId && candidate.idea_id === ideaId);
    if (!idea) throw new Error(`Customer API /customers/${personaId}/ideas/${ideaId} failed: HTTP 404`);
    return { ...idea };
  }
}

/*
 * VITE_CUSTOMER_DATA_MODE overrides VITE_DATA_MODE for this service only,
 * so a live-mode dev server (real flags) can still show the mocks. Unset in
 * the pipeline's live build, so the mock and its test-data tree-shake out.
 */
const CUSTOMER_DATA_MODE = import.meta.env.VITE_CUSTOMER_DATA_MODE || import.meta.env.VITE_DATA_MODE;

export const customerService: CustomerService = CUSTOMER_DATA_MODE === "live" ? new LiveCustomerService() : new MockCustomerService();
