import type { Nyc311Environment } from "../stack/Nyc311Stack";

/* The Team Chat API's domain per environment (docs/17-executive-team.md §10.1). */
export const TEAM_CHAT_API_DOMAIN: Record<Nyc311Environment, string> = {
  TEST: "chat-api.test.boroughsim.com",
  PROD: "chat-api.boroughsim.com",
};

/*
 * Stage-wide throttle (§10.5): bounds a runaway agent loop and a crowd
 * polling the open reads every 5 s. Per stage, not per caller.
 */
export const TEAM_CHAT_THROTTLE = { rateLimit: 10, burstLimit: 20 };
