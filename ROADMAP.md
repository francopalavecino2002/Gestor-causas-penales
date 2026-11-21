# ROADMAP

Source of truth for the autonomous work loop (`/next-task`). One task = one PR.

**Status:** `todo` · `in-progress` · `blocked` · `done (#PR)`
**Owner:** `backend` (OpenCode first, see CLAUDE.md) · `frontend` (Claude + frontend-design) · `orchestrator`
**Needs:** task ids that must be `done`, or a gate:
- `gate:domain` — the reviewed domain docs exist in `docs/domain/` with `status: reviewed`
  in their front matter (stage 0 research: catalogs, deadline rules).
- `gate:design` — `docs/design/DESIGN.md` exists with `status: approved` (stage 2: visual
  direction approved by Franco).

Gates are opened only by a human edit. The loop never opens a gate by itself.

## Milestone 0: Foundations

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T00 | Toolchain check: run `opencode --version`, `opencode run --help`, `opencode models`; fill `.claude/opencode-models.txt` with up to 3 free models (prefer ones marked free/zero cost); confirm `gh auth status`, `docker compose version`, `java -version`, `node -v`. Check that `opencode.json` is accepted (fix keys if opencode reports a config error). Record results in `docs/DECISIONS.md` (ADR-0003). If a tool is missing, mark this task `blocked` with install instructions. | orchestrator | — | done (#2) |
| T01 | Backend skeleton: Spring Boot (latest stable), Java 21, Maven wrapper, web, validation, actuator, data-jpa, security (permit `/actuator/health` only), Flyway, PostgreSQL driver, Lombok with explicit `annotationProcessorPaths`, Testcontainers. `docker-compose.yml` at repo root with Postgres on 5434. App on 8081. One integration test that boots the context against Testcontainers. | backend | T00 | todo |
| T02 | CI: GitHub Actions workflow `ci.yml` with a backend job (`./mvnw -B verify`) and a frontend job (lint, typecheck, test, build) that run only when their folder exists/changes. Add CI badge to README. | orchestrator | T01 | todo |
| T03 | Frontend skeleton: Vite + React + TypeScript, Tailwind v4, shadcn/ui init, TanStack Query + Router, ESLint + Prettier, Vitest + Testing Library, Playwright smoke test, vite-plugin-pwa (manifest in Spanish), API proxy to 8081. A neutral placeholder home ("Gestor de causas penales, en construcción"). No visual design yet. | frontend | T00 | todo |
| T04 | Multi-tenancy foundation: `tenant` (estudio) table, `tenant_id` on every table, request-scoped tenant context resolved from the authenticated user, Hibernate filter or PostgreSQL RLS (decide via ADR, Opus). Integration test proving tenant A cannot read tenant B. | backend | T01 | todo |
| T05 | Auth: users with roles `OWNER` (titular), `LAWYER`, `PARALEGAL` (procurador), `ADMIN_STAFF` (administrativo); login with secure session or JWT (ADR); password hashing (Argon2/bcrypt); rate limiting on login; `/api/v1/me`. | backend | T04 | todo |
| T06 | 2FA with TOTP (enroll, verify, recovery codes). | backend | T05 | todo |
| T07 | Audit log: generic change history (who, when, entity, field, old, new) + archive instead of delete (`archived_at`), with tests. | backend | T04 | todo |
| T08 | Fictitious seed data generator (profile `demo`): 1 firm, 3 users, Spanish fake names clearly fictitious. | backend | T07 | todo |
| T09 | README for portfolio: product pitch, architecture diagram (Mermaid), how to run locally, tech decisions, screenshots section. `CHANGELOG.md` (Keep a Changelog). | orchestrator | T02, T03 | todo |

## Milestone 1: Domain core (after stage 0)

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T10 | Jurisdiction package mechanism: load catalogs (hearing types, stages, coercive measures, alternative outcomes, offenses, circumscriptions) from versioned YAML/JSON under `backend/src/main/resources/jurisdictions/neuquen/`; firms can override per tenant. | backend | T07, gate:domain | todo |
| T11 | Persons and clients (one record per person, roles per case, sensitive data separated with restricted access). | backend | T07, gate:domain | todo |
| T12 | Case (legajo): identifiers, circumscription, stage, accused persons with charges and liberty status, team assignment, reserved cases. | backend | T10, T11 | todo |
| T13 | Hearings (audiencias): type, date/time, room, judge, OFIJU reference, result, rescheduling history; agenda queries by day/week/lawyer. | backend | T12 | todo |
| T14 | Deadline rule engine: rules with legal source, suspension events (e.g. penal mediation), computed due dates, alerts. Never presented as authoritative. (Opus) | backend | T12, gate:domain | todo |
| T15 | Custom fields and templates per case type (JSONB + schema per tenant). | backend | T12 | todo |
| T16 | CSV/Excel import of cases and persons with preview and validation report. | backend | T12 | todo |

## Milestone 2: Product UI (after stage 2)

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T20 | Design system in code: tokens, typography, color, shadcn theme, base components, light/dark, documented in `docs/design/`. | frontend | T03, gate:design | todo |
| T21 | App shell: login + 2FA, navigation (mobile bottom nav, desktop sidebar), firm switcher. | frontend | T20, T06 | todo |
| T22 | Agenda de audiencias (home): today / week, by lawyer, mobile-first. | frontend | T21, T13 | todo |
| T23 | Case list and case detail. | frontend | T21, T12 | todo |
| T24 | Deadlines view with source and disclaimer. | frontend | T21, T14 | todo |
| T25 | Settings: catalogs, custom fields, templates, users and roles. | frontend | T21, T15 | todo |
| T26 | Import wizard. | frontend | T21, T16 | todo |
