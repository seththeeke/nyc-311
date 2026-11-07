---
name: query-builder
description: Turns a business question into one ready-to-run Athena SQL query against BoroughSim's data warehouse, using the real table schemas, enum values and query idioms. Use whenever you need to write SQL for the warehouse - to answer a question about orders, operators, cost, time to resolve, the fleet or the public API, to build a saved report query, or when the user asks for a query they can paste into the Admin SQL console. Drafts only; it never runs, saves or schedules anything.
---

# query-builder

Write one Athena query that answers a business question about BoroughSim. This
skill drafts SQL; whoever invoked it decides whether to run it (Celestine
through her `run_query` tool, the CEO in the Admin SQL console).

## Before writing

1. Read **`reference.md`** in this folder: the tables, what each column
   means, the enum values actually persisted, and the idioms and traps.
2. For the exact column list, **`cdk/warehouse/warehouseTableSchemas.ts`**
   is the source of truth. If `reference.md` and that file disagree, trust
   the file, and say what drifted.
3. When a question touches how a number is produced (cost, time to
   resolve, rejections), read the code or SQL that produces it before
   reusing it: `docs/v1-wbr.sql` for the WBR's definitions,
   `docs/business-insights.md` for the cost model, and `backend/models/` for
   event payloads.

## Writing it

- **Engine:** Athena, Trino SQL. The workgroup sets the database, so write
  bare table names (`FROM order_events`), never database-qualified.
- **Read-only:** the statement starts with `SELECT`, `WITH`, `SHOW`,
  `DESCRIBE` or `EXPLAIN`. Anything else is rejected.
- **Limits:** 500 rows back, 1 GB scanned, 20 seconds. Aggregate in SQL
  rather than pulling raw rows, and bound every query to a time window.
- **Defaults over questions:** pick a sensible window, cutoff or tie-break
  and state it in a `--` comment at the top of the SQL. Don't stop to ask.
- **Header:** start the query with `--` lines naming the question it
  answers and each assumption.
- **One query.** If the question needs two, write the one that answers
  most of it and say what the second would add.

## Output

One fenced ```` ```sql ```` block, then at most two lines: what the result's
columns mean, and any caveat a reader must know (an approximation, a
known data gap). If the warehouse can't answer the question at all, say so
in one sentence and name the data that's missing. Never invent a table or
column.
