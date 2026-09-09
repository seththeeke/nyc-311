# Things to Come Back To

Running list of items deliberately deferred — not forgotten, just not worth
blocking current work on. Each entry links to a GitHub issue (labeled
`backlog`) where the full context lives; use the `log-backlog-item` skill
to add new entries or migrate old ones.

---

## Pipeline metrics and build-time optimization

See [#9](https://github.com/seththeeke/nyc-311/issues/9).

---

## Manual/forced polling controls for the ingestion Lambda

**Resolved 2026-09-07** — see [#1](https://github.com/seththeeke/nyc-311/issues/1) (closed).

---

## Publishing code coverage (GitHub badge or hosted report)

**Resolved 2026-08-23** — see [#2](https://github.com/seththeeke/nyc-311/issues/2) (closed).

---

## Poller is permanently capped — the ingestion window hasn't advanced in 6+ days

**Resolved 2026-09-07** — see [#3](https://github.com/seththeeke/nyc-311/issues/3) (closed).

---

## Custom domain names for the site(s) and APIs

**Resolved 2026-09-07** — see [#4](https://github.com/seththeeke/nyc-311/issues/4) (closed); `docs/8-domain-name-assignment.md`.

---

## Existing draft-Request backlog won't reach the order-ingestion pipeline

See [#5](https://github.com/seththeeke/nyc-311/issues/5).

---

## Lambda metrics on the Monitoring Page

**Resolved 2026-09-07** — see [#6](https://github.com/seththeeke/nyc-311/issues/6) (closed).

---

## Order-ingestion design gaps accepted when `3-order-ingestion.md` closed

See [#7](https://github.com/seththeeke/nyc-311/issues/7).

---

## No automatic Case creation when order-evaluation permanently fails

See [#8](https://github.com/seththeeke/nyc-311/issues/8).

---

## GET /order-events event_type filter (without order_id) can return empty pages indefinitely at scale

See [#10](https://github.com/seththeeke/nyc-311/issues/10).

---

## Order-scheduling job re-Cases the same unroutable Order every hourly run

See [#11](https://github.com/seththeeke/nyc-311/issues/11).

---

## cdk/ local test:coverage runs ~30 synth-heavy files fully serial for a CI-only reason

**Resolved 2026-09-02** — see [#12](https://github.com/seththeeke/nyc-311/issues/12) (closed).

---

## Stale demo-frontend/ prototype slows local Claude searches

**Resolved 2026-08-30** — see [#14](https://github.com/seththeeke/nyc-311/issues/14) (closed).

---

## test:coverage prints ~163 zero-signal 100%-covered rows every Operational-Loop run

**Resolved 2026-09-01** — see [#16](https://github.com/seththeeke/nyc-311/issues/16) (closed).

---

## Pipeline integration suite runs 4 live-API test files serially

**Resolved 2026-09-02** — see [#18](https://github.com/seththeeke/nyc-311/issues/18) (closed).

---

## cdk pipeline tests re-synth the full pipeline stack once per it()

**Resolved 2026-09-02** — see [#20](https://github.com/seththeeke/nyc-311/issues/20) (closed).

---

## web-app test suite dominated by jsdom + forks per-file startup

**Resolved 2026-09-03** — see [#22](https://github.com/seththeeke/nyc-311/issues/22) (closed).

---

## biz-intel-agent — own the BI/reporting layer (job authoring + Athena/Glue efficiency)

See [#24](https://github.com/seththeeke/nyc-311/issues/24).

---

## Warehouse pipeline alarm suite (Firehose freshness/errors, SFN ExecutionsFailed, stuck-FAILED, LocationsFanOut)

Deferred from `7-data-warehousing.md` Leg 5 — runs on OOTB metrics + logs
for now, no alarms/email while scaled down. See [#25](https://github.com/seththeeke/nyc-311/issues/25).

---

## cdk/ coverage gate excludes step-function/ and warehouse/ (14/53 files, 26%, unenforced)

See [#26](https://github.com/seththeeke/nyc-311/issues/26).

---
