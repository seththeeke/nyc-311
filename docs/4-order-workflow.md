# Order Workflow — Third Backend Slice

> Negotiated starting **2026-08-18**, same progressive/negotiated style as
> `1-data-ingestion.md` / `2-pipeline-monitoring.md`. Scopes and designs
> build-order item 2 (`claude-prompt-initial.md` §10): "Order Workflow Step
> Functions state machine with the 5 stages as stub Lambdas... just prove
> the state machine, retries, and Case-creation handoff work." (Stage count
> corrected to **4** by `capacity-model.md` §8 — `Plan` was removed.)
>
> **Sequenced after `3-order-ingestion.md`**, which owns how a `Request`
> becomes an `Order` in the first place (the stream listener → filter →
> `OrderCreated` path) — originally sketched as part of this doc, split out
> once it became clear that path is real, standing infrastructure, not a
> stub. This doc picks up starting from "an `Order` exists in its first
> state" and owns the state machine that actually moves it through
> `Ingest → Schedule → Execute → Resolve`, plus retries and the
> Case-creation handoff on failure. Exactly where the boundary sits (does
> `3-order-ingestion.md`'s creation step also start the Step Functions
> execution, or does something in this doc do that) is still to be settled
> once `3-order-ingestion.md` is further along.
>
> Unlike `1-data-ingestion.md`, `backend/` and `cdk/` are already unlocked
> (`CLAUDE.md` §5.1/§5.2) — this doc exists to settle the same class of
> design questions before writing code, not to unlock a directory.
>
> The data model this slice builds against is **already fully locked**:
> `Order`/`OrderEvent` fields and event types (`data-model.md#order`), the
> `Orders` table key schema + GSIs (`ddb-design.md`), and the Order Workflow
> shape itself (`Ingest → Schedule → Execute → Resolve`, `capacity-model.md`
> §8). This doc is about *how this slice builds toward that model without
> prematurely deciding things still `[OPEN]` elsewhere* (real capacity
> logic, agentic Case resolution).

---

## Decision Status

| Topic | Status |
|---|---|
| [1. Step Functions machine design](#1-step-functions-machine-design) | **[OPEN]** |
| [2. Stub stage behavior](#2-stub-stage-behavior) | **[OPEN]** |
| [3. Error taxonomy & retry/Catch policy](#3-error-taxonomy--retrycatch-policy) | **[OPEN]** |
| [4. Induced-failure mechanism for this slice](#4-induced-failure-mechanism-for-this-slice) | **[OPEN]** |
| [5. Case-creation handoff scope](#5-case-creation-handoff-scope) | **[OPEN]** |
| [6. DAO layer](#6-dao-layer) | **[OPEN]** |
| [7. Observability & custom metrics](#7-observability--custom-metrics) | **[OPEN]** |
| [8. Testing](#8-testing) | **[OPEN]** |

*(Not yet elaborated — picked back up once `3-order-ingestion.md` is
settled.)*
