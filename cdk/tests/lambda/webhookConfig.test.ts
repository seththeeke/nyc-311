import { describe, expect, it } from "vitest";
import {
  WEBHOOK_ALLOWED_CALLBACK_HOSTS,
  WEBHOOK_SINK_SECRET_PARAMETER_NAME,
  WEBHOOK_SSM_PREFIX,
} from "../../lambda/webhookConfig";
import { DOMAIN_CONFIG } from "../../stack/Nyc311Stack";

describe("webhookConfig", () => {
  it("allows Test callbacks only to Test's own API domain, where the sink lives", () => {
    expect(WEBHOOK_ALLOWED_CALLBACK_HOSTS.TEST).toEqual([DOMAIN_CONFIG.TEST.apiDomain]);
  });

  it("never allows a Prod callback to the bureau's own API", () => {
    expect(WEBHOOK_ALLOWED_CALLBACK_HOSTS.PROD).not.toContain(DOMAIN_CONFIG.PROD.apiDomain);
    expect(WEBHOOK_ALLOWED_CALLBACK_HOSTS.PROD).toEqual(["customer-api.boroughsim.com"]);
  });

  it("keeps each environment's secrets under its own SSM prefix, the sink's outside the subscription secret wildcard", () => {
    expect(WEBHOOK_SSM_PREFIX).toEqual({ TEST: "/nyc311/test/webhook", PROD: "/nyc311/prod/webhook" });
    expect(WEBHOOK_SINK_SECRET_PARAMETER_NAME.startsWith(`${WEBHOOK_SSM_PREFIX.TEST}/`)).toBe(false);
  });
});
