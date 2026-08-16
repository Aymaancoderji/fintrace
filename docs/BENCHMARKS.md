# Benchmarks

This documents how to reproduce FinTrace's two headline performance numbers —
**ingestion throughput** (transactions/sec actually written to Neo4j, not just
accepted over HTTP) and **alert query latency** under concurrent load — and
records results as they're captured.

No numbers are recorded yet. The tooling below (`src/scripts/generateSyntheticData.ts`,
`src/scripts/loadTest.ts`) is written and was verified as far as it can be
without live infrastructure: the CSV generator runs standalone and its output
was validated against the same zod schema and CSV parser the ingestion API
uses (see `src/scripts/generateSyntheticData.test.ts`), and `loadTest.ts`'s
login/error-handling path and its `autocannon` invocation were smoke-tested
against a running API. The full run — which needs Postgres, Neo4j, Redis, the
API, and the worker all up — has not been executed, because this environment
has no Docker daemon. Run it yourself with the steps below and fill in the
table.

## How to run

```bash
docker compose up -d
npm run db:migrate
npm run db:migrate:postgres
npm run db:seed

# in separate terminals:
npm run dev
npm run worker

# generate synthetic data, then run the benchmark
npm run generate:data -- 50000 .data/synthetic-transactions.csv
npm run load-test -- .data/synthetic-transactions.csv http://localhost:3000
```

`load-test` will:
1. Log in as the seeded `admin` user.
2. POST the CSV to `/transactions/batch` and time the upload.
3. Poll the BullMQ queue until every row has been written to Neo4j, and report
   `txns/sec = queued / drain_seconds` — the real end-to-end ingestion rate.
4. Run `POST /detection/run` once and report its latency.
5. Hit `GET /alerts` with `autocannon` (20 connections, 15s) and report
   p50/p95/p99 latency and req/sec.

## Query plans

`npm run db:explain` runs `EXPLAIN`/`PROFILE` against each detection rule's
real Cypher (imported from the rule modules, not duplicated) and prints the
operator tree with `dbHits`/`rows` per step — use it to check a rule is doing
an index seek rather than a full label scan before assuming a slowdown is
about data volume rather than the query plan.

## Results

| Date | Data volume | Ingestion throughput | Alert query p50 / p95 / p99 | Notes |
|------|-------------|----------------------|------------------------------|-------|
| _(none yet — run `npm run load-test` and record here)_ | | | | |

## Known cost centers (from reading the query plans, not yet measured)

- **`cycle` rule**: the only unbounded-shape query — `MATCH path = (a:Account)-[:SENT\|RECEIVED_BY*4..10]->(a)` starts from every `Account` node (no index seek possible for "any account matching this shape") and its cost grows with graph density, not just size. `maxHops` was set to 10 (not the original 16) for this reason — see the comment in `src/detection/rules/cycles.ts`. If this rule is slow at volume, the fix is a precomputed/materialized cycle-candidate table refreshed on a schedule, not a bigger index.
- **`structuring` and `fan-in-fan-out` rules**: traverse from `Account` via `SENT`/`RECEIVED_BY` rather than seeking `Transaction` by property, so the `transaction_timestamp`, `transaction_amount`, and `transaction_timestamp_amount` indexes don't change their plans — they help only if a future query seeks `Transaction` directly (e.g. a `GET /transactions?since=...` listing endpoint). Confirm this with `npm run db:explain` before trusting it.
- At real volume, the honest next step for all three rules is capping the lookback window tightly (they already default to `P7D`) and, if that's not enough, moving from "run all rules over the whole graph on demand" to incremental/windowed detection — out of scope for this phase.
