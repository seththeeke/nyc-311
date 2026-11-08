/** UI settings. The API is same-origin: `npm start` serves both, and `npm run dev` proxies /api (vite.config.ts). */
export const config = {
  apiBaseUrl: "/api",
  /** How often the dashboard and agent pages refresh. */
  refreshMs: 10_000,
  /** How often a running run's status and log refresh. */
  liveMs: 2_000,
};
