import { describe, expect, it } from "vitest";
import {
  CUSTOMER_API_DOMAIN,
  CUSTOMER_LAMBDA_BUNDLING,
  CUSTOMER_ROOT_DOMAIN,
  CUSTOMER_SIGNING_SECRET_PARAMETER_NAME,
  CUSTOMER_STACK_NAME,
  CUSTOMER_WEBHOOK_PATH,
} from "../../customer/customerConfig";

describe("customerConfig", () => {
  it("puts the customer API on its own name under the shared root domain", () => {
    expect(CUSTOMER_API_DOMAIN).toBe("customer-api.boroughsim.com");
    expect(CUSTOMER_API_DOMAIN.endsWith(`.${CUSTOMER_ROOT_DOMAIN}`)).toBe(true);
    expect(CUSTOMER_WEBHOOK_PATH).toBe("/webhooks/bureau");
  });

  it("keeps the signing secret outside the bureau's own parameter prefix", () => {
    expect(CUSTOMER_SIGNING_SECRET_PARAMETER_NAME).toBe("/customer/prod/webhook/signing-secret");
    expect(CUSTOMER_SIGNING_SECRET_PARAMETER_NAME.startsWith("/nyc311/")).toBe(false);
  });

  it("names the stack distinctly from the bureau's and minifies its bundles", () => {
    expect(CUSTOMER_STACK_NAME).toBe("Nyc311Customer-Prod");
    expect(CUSTOMER_LAMBDA_BUNDLING).toEqual({ minify: true, keepNames: true });
  });
});
