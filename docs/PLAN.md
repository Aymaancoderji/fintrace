# FinTrace — Phased Build Plan

## Context
FinTrace is a from-scratch AML/transaction-monitoring engine: a graph-based system that ingests financial transactions, models them as a network, and detects suspicious patterns (structuring, layering, mule networks, cycles) for fraud/AML analysts. The working directory is currently empty — this is a greenfield build. The user wants the project name kept as **FinTrace** and the stack fixed as **Node.js/TypeScript (Fastify) + Neo4j**, and wants the build broken into phases suitable for iterative development and a strong resume/portfolio narrative (real production-shaped infrastructure, not a toy).

The plan below sequences the build so that each phase ends in something runnable and demoable, with the graph engine and detection logic (the most resume-relevant/differentiated part) front-loaded rather than left to the end.

## Tech Stack
- **Runtime**: Node.js + TypeScript
- **API**: Fastify
- **Graph store**: Neo4j (Cypher) — native graph traversal for ring/cycle/fan-in-fan-out detection
- **Relational/audit store**: Postgres (case management, audit trail, user accounts) — Neo4j is not a great fit for this metadata
- **Queue**: BullMQ (Redis-backed) for async ingestion/scoring pipelines
- **Testing**: Vitest + Testcontainers (spin up real Neo4j/Postgres in CI, per the project's own "test against real infra, not mocks" instinct)
- **Frontend** (Phase 5+): React + Vite, minimal graph-visualization UI (e.g. react-force-graph or Cytoscape.js)

## Phase 0 — Scaffolding & Repo Setup
- `npm init`, TypeScript config, ESLint/Prettier, Fastify skeleton with a `/health` route
- Docker Compose: Neo4j + Postgres + Redis for local dev
- Basic CI (lint + typecheck + test) via GitHub Actions
- `README.md` with project pitch, architecture diagram placeholder
- **Deliverable**: `docker compose up` gives a running API that answers `/health`; CI green on push

## Phase 1 — Data Model & Ingestion
- Define core entities: `Account`, `Transaction`, `Entity` (person/business), relationships (`SENT`, `RECEIVED`, `OWNS`, `LINKED_TO`)
- Neo4j schema/constraints (uniqueness on account IDs, indexes on timestamps/amounts)
- Ingestion endpoint(s): accept transactions (CSV batch upload + single JSON POST), validate, write to Neo4j via a repository layer
- Idempotent ingestion (dedupe by transaction ID) via BullMQ worker
- **Deliverable**: can POST/upload transaction data and see it materialize as a graph in Neo4j Browser

## Phase 2 — Detection Engine (core differentiator)
- Cypher-based detection rules as a pluggable rule interface:
  - **Structuring/smurfing**: many sub-threshold transactions aggregating above a limit in a time window
  - **Cycles/round-tripping**: A→B→C→A patterns via variable-length path queries
  - **Fan-in/fan-out**: one account receiving from or sending to many distinct counterparties in a short window
  - **Mule network detection**: shared attributes (device/IP/address) linking seemingly unrelated accounts
- Each rule emits a scored **Alert** with the implicated subgraph (node/edge IDs) attached
- Alerts persisted in Postgres (structured, queryable, joins cleanly to case data)
- **Deliverable**: ingesting a crafted "dirty" dataset produces the expected alerts; unit tests per rule against Testcontainers Neo4j

## Phase 3 — Scoring, Case Management & API
- Risk scoring: combine rule hits into a weighted account/entity risk score
- Case management API: analysts can open/assign/annotate/close cases tied to alerts
- Full REST API surface: accounts, transactions, alerts, cases, graph-neighborhood queries (`GET /accounts/:id/subgraph?depth=2`)
- AuthN/AuthZ (JWT, role-based: analyst vs admin)
- **Deliverable**: a documented (OpenAPI) API where an analyst workflow — ingest → alert → investigate subgraph → open case — works end-to-end via curl/Postman
  - [x] `GET /docs` (Swagger UI) + `GET /docs/json` (raw spec), `src/docs/openapi.ts`, covering all 16 routes

## Phase 4 — Performance & Production Hardening
- Load testing ingestion + detection at volume (synthetic data generator, k6 or autocannon)
- Query optimization: Cypher `EXPLAIN`/`PROFILE`, indexing pass, pagination on subgraph queries
- Structured logging + metrics (Prometheus-style `/metrics`), request tracing
- Rate limiting, input validation hardening, secrets via env/vault pattern
- **Deliverable**: documented benchmark numbers (txns/sec ingested, alert query latency) — this is the "performance engine" resume proof point

## Phase 5 — Visualization UI (optional but high resume value)
- React + Vite app: transaction graph explorer (pan/zoom subgraph around an alerted account), alert queue, case detail view
- Talks to the Phase 3 API only — no direct DB access from frontend
- **Deliverable**: a screenshot/demo GIF-able UI showing an alert and its subgraph — this is what makes the project legible to a non-technical reviewer

## Phase 6 — Containerization Finish & Local Prod Verification
Groundwork exists (`Dockerfile`, `web/Dockerfile`, `web/nginx.conf`, `docker-compose.prod.yml`, `.dockerignore`, `tsconfig.build.json`). Done so far, without a live Docker daemon:
- Added the missing `.env.docker.example` (`NEO4J_PASSWORD`, `POSTGRES_PASSWORD`, `JWT_SECRET`, `WEB_ORIGIN`, `VITE_API_BASE_URL`) and gitignored `.env.docker`
- Added `web/.dockerignore` (was missing, so the web build context would've included `node_modules`)
- Static-verified the wiring: `env.ts`'s schema matches every var `docker-compose.prod.yml` injects; `npm run build` produces exactly the entrypoints the `Dockerfile`/compose commands reference (`dist/index.js`, `dist/worker.js`, `dist/db/migrate.js`, `dist/db/migratePostgres.js`, `dist/db/migrations/*.sql`); `web`'s `vite build` produces `dist/index.html` + hashed `/assets/` matching `nginx.conf`'s cache/fallback rules
- Fixed a real gap found in review: `src/worker.ts` had no `SIGTERM`/`SIGINT` handler, so `docker compose stop`/`down` would force-kill it mid-batch-write instead of letting BullMQ drain in-flight jobs (the API already handled this in `src/index.ts`) — now mirrors that pattern
- `npm run typecheck`, `npm run lint`, and `npm test` all pass after these changes
- **Still needed** (blocked here — no Docker daemon in this environment): actually run `docker compose -f docker-compose.prod.yml --env-file .env.docker up --build` and verify migrate completes, all healthchecks pass, and login → ingest → detect → subgraph works against the containerized stack
- **Deliverable**: one `docker compose -f docker-compose.prod.yml up` boots the full stack (api, worker, web, neo4j, postgres, redis) from a clean checkout

## Phase 7 — Real Benchmarks
`docs/BENCHMARKS.md` tooling is written and unit-tested but has never been run against live infra — the results table is empty.
- Run `npm run generate:data` + `npm run load-test` against the Phase 6 stack (or `docker compose up` dev stack) and record real ingestion throughput + alert-query p50/p95/p99 in `docs/BENCHMARKS.md`
- Run `npm run db:explain` against real data volume and confirm (or correct) the "known cost centers" writeup, especially the `cycle` rule
- **Deliverable**: `docs/BENCHMARKS.md` results table filled in with actual numbers, not placeholders

## Phase 8 — Deployment
- Pick a target (Fly.io/Render/Railway — free/cheap tier)
- Configure prod secrets (`JWT_SECRET`, DB passwords) via the platform's secret store, not committed files
- Deploy with seeded demo data (`npm run db:seed` equivalent against prod DB)
- Verify the live URL end-to-end: login → ingest → detect → subgraph → case
- **Deliverable**: a live, link-able demo URL

## Phase 9 — Final Polish & First Commit
- [x] Architecture diagram (`docs/architecture.svg`, embedded in `README.md`)
- [x] Sample alert walkthrough (curl-based, in `README.md`) covering ingest → detect → alerts → subgraph → case
- [x] "Why this matters" AML framing for non-technical reviewers, in `README.md`
- [x] Staged and committed in logical chunks (scaffolding/ingestion/detection/API, web UI polish, OpenAPI docs + CI) rather than one giant initial commit, so the history reads as a coherent build
- [ ] Screenshots/demo GIF of the actual running UI — needs the live stack (Phase 6/8), not done here
- **Deliverable**: a polished repo with real commit history, ready to link from a resume

## Verification Approach (applies throughout)
- Each phase ships with its own Vitest suite; graph-dependent tests run against a real Neo4j via Testcontainers (no mocking the graph store)
- Manual verification per phase via the deliverable described above (health check, Neo4j Browser inspection, curl walkthrough, or UI demo)
- CI must stay green before moving to the next phase

## Immediate Next Step
Phases 0-5 are complete, and the Phase 3 OpenAPI docs gap is closed (`GET /docs`). CI now also lints/typechecks/builds `web/` (previously only the API was checked).

Phase 6's static wiring was re-verified in this session (2026-09-04): `src/config/env.ts`'s schema still matches every var `docker-compose.prod.yml` injects (`NODE_ENV`, `NEO4J_URI/USER/PASSWORD`, `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `WEB_ORIGIN`), the prod-JWT-secret guard is intact, and `Dockerfile`/`web/Dockerfile`/`web/nginx.conf` still match the compose file's commands and ports. `npm run lint`, `npm run typecheck`, and `npm test` all pass on `master`. Docker is still not available in this dev environment (no `docker` binary, no passwordless `sudo` to install it), so Phase 6's actual `docker compose up --build` run, Phase 7's live benchmarks, and Phase 8's deployment remain blocked here and need to be run wherever Docker is available.
