/* The Residents page's routes, in one place so links, the router and the secondary workspace agree. */

export const RESIDENTS_PATH = "/residents";
export const IDEA_DETAIL_PATTERN = "/residents/:personaId/ideas/:ideaId";
/* The Contacts tab (docs/17-executive-team.md §17.3), behind CONTACTS_PAGE. */
export const CONTACTS_PATH = "/residents/contacts";

/** The Idea Detail view for one idea, addressed by its resident. */
export function ideaDetailPath(personaId: string, ideaId: string): string {
  return `${RESIDENTS_PATH}/${encodeURIComponent(personaId)}/ideas/${encodeURIComponent(ideaId)}`;
}

/** The feed, focused on one resident. */
export function residentFeedPath(personaId: string): string {
  return `${RESIDENTS_PATH}?persona=${encodeURIComponent(personaId)}`;
}
