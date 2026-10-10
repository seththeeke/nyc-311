import type { Nyc311Environment } from "../stack/Nyc311Stack";

/*
 * Shared constants for the bureau's outbound webhooks
 * (13-customer-simulation.md §5). SSM names are lowercase paths, not
 * env-suffixed physical names — a parameter hierarchy follows its own
 * convention, like the ALL_CAPS carve-outs in CLAUDE.md §6.
 */

/* `<prefix>/registration-key` (created by hand) and `<prefix>/<subscription_id>/secret` (written at registration). */
export const WEBHOOK_SSM_PREFIX: Record<Nyc311Environment, string> = {
  TEST: "/nyc311/test/webhook",
  PROD: "/nyc311/prod/webhook",
};

/* The Test-only sink subscriber's own copy of its signing secret — created by hand, like the registration key. */
export const WEBHOOK_SINK_SECRET_PARAMETER_NAME = "/nyc311/test/webhook-sink/secret";

/*
 * Hostnames a callback URL may use. Test's only subscriber is the sink on
 * Test's own API domain; Prod's is the customer's listener, whose host is
 * still provisional (13-customer-simulation.md §4 item 11).
 */
export const WEBHOOK_ALLOWED_CALLBACK_HOSTS: Record<Nyc311Environment, string[]> = {
  TEST: ["api.test.boroughsim.com"],
  PROD: ["customer-api.boroughsim.com"],
};
