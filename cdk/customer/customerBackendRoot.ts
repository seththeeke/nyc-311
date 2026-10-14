import * as path from "node:path";

/*
 * The one sanctioned place that names the customer's code package
 * (CLAUDE.md §5.3, `local/customer-boundary`). Every customer Lambda's
 * entry point is built from this; no other file under cdk/customer/ may
 * contain a `backend` path segment, so none can point at the bureau's.
 */
export const CUSTOMER_BACKEND_ROOT = path.join(__dirname, "..", "..", "customer", "backend");
