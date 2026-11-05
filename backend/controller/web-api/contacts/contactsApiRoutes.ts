/* The contacts bundle's route keys (17-executive-team.md §17.3). Imports nothing: cdk/api/Nyc311Api.ts imports it. */
export const CONTACTS_API_ROUTES = ["GET /contacts"] as const;

export type ContactsApiRouteKey = (typeof CONTACTS_API_ROUTES)[number];
