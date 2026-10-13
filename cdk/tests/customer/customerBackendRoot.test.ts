import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import { CUSTOMER_BACKEND_ROOT } from "../../customer/customerBackendRoot";

describe("CUSTOMER_BACKEND_ROOT", () => {
  it("points at the customer's own package, not the bureau's", () => {
    const repoRoot = path.join(__dirname, "..", "..", "..");
    expect(path.relative(repoRoot, CUSTOMER_BACKEND_ROOT)).toBe(path.join("customer", "backend"));
  });

  it("names a real package with the listener's entry point and a lock file", () => {
    expect(fs.existsSync(path.join(CUSTOMER_BACKEND_ROOT, "package-lock.json"))).toBe(true);
    expect(fs.existsSync(path.join(CUSTOMER_BACKEND_ROOT, "controller", "webhook", "receiveWebhookController.ts"))).toBe(true);
  });
});
