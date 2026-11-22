# ROADMAP

Source of truth for the autonomous work loop (`/next-task`). One task = one PR.

**Status:** `todo` · `in-progress` · `blocked` · `done (#PR)`
**Owner:** `backend` (OpenCode first, see CLAUDE.md) · `frontend` (Claude + frontend-design) · `orchestrator`
**Needs:** task ids that must be `done`, or a gate:
- `gate:domain` — the reviewed domain docs exist in `docs/domain/` with `status: reviewed`
  in their front matter (stage 0 research: catalogs, deadline rules).
- `gate:design` — `docs/design/DESIGN.md` exists with `status: approved`, written by T19.

**Standing instruction from Franco (2026-11-22):** never stop to ask him for approval. A gate
whose prerequisite is a task in this ROADMAP opens when that task is merged; the loop picks the
best option itself and records it as an ADR. Only ask Franco for things that physically need him
(a browser sign-in, a credential). `gate:design` is produced by T19.

## Milestone 0: Foundations

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T00 | Toolchain check: run `opencode --version`, `opencode run --help`, `opencode models`; fill `.claude/opencode-models.txt` with up to 3 free models (prefer ones marked free/zero cost); confirm `gh auth status`, `docker compose version`, `java -version`, `node -v`. Check that `opencode.json` is accepted (fix keys if opencode reports a config error). Record results in `docs/DECISIONS.md` (ADR-0003). If a tool is missing, mark this task `blocked` with install instructions. | orchestrator | — | done (#2) |
| T01 | Backend skeleton: Spring Boot (latest stable), Java 21, Maven wrapper, web, validation, actuator, data-jpa, security (permit `/actuator/health` only), Flyway, PostgreSQL driver, Lombok with explicit `annotationProcessorPaths`, Testcontainers. `docker-compose.yml` at repo root with Postgres on 5434. App on 8081. One integration test that boots the context against Testcontainers. | backend | T00 | done (#4) |
| T02 | CI: GitHub Actions workflow `ci.yml` with a backend job (`./mvnw -B verify`) and a frontend job (lint, typecheck, test, build) that run only when their folder exists/changes. Add CI badge to README. | orchestrator | T01 | done (#5) |
| T03 | Frontend skeleton: Vite + React + TypeScript, Tailwind v4, shadcn/ui init, TanStack Query + Router, ESLint + Prettier, Vitest + Testing Library, Playwright smoke test, vite-plugin-pwa (manifest in Spanish), API proxy to 8081. A neutral placeholder home ("Gestor de causas penales, en construcción"). No visual design yet. | frontend | T00 | done (#6) |
| T04 | Multi-tenancy foundation: `tenant` (estudio) table, `tenant_id` on every table, request-scoped tenant context resolved from the authenticated user, Hibernate filter or PostgreSQL RLS (decide via ADR, Opus). Integration test proving tenant A cannot read tenant B. | backend | T01 | done (#8) |
| T05 | Auth: users with roles `OWNER` (titular), `LAWYER`, `PARALEGAL` (procurador), `ADMIN_STAFF` (administrativo); login with secure session or JWT (ADR); password hashing (Argon2/bcrypt); rate limiting on login; `/api/v1/me`. | backend | T04 | done (#9) |
| T06 | 2FA with TOTP (enroll, verify, recovery codes). | backend | T05 | done (#11) |
| T07 | Audit log: generic change history (who, when, entity, field, old, new) + archive instead of delete (`archived_at`), with tests. | backend | T04 | done (#12) |
| T08 | Fictitious seed data generator (profile `demo`): 1 firm, 3 users, Spanish fake names clearly fictitious. | backend | T07 | done (#13) |
| T09 | README for portfolio: product pitch, architecture diagram (Mermaid), how to run locally, tech decisions, screenshots section. `CHANGELOG.md` (Keep a Changelog). | orchestrator | T02, T03 | done (#14) |

## Milestone 1: Domain core (after stage 0)

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T10 | Jurisdiction package mechanism: load the Neuquén catalogs from `docs/domain/neuquen-review.md` §2 (stages 2.1 and closing outcomes, hearing types 2.2 with article and 2014 frequency for ordering, hearing statuses and cancellation reasons, coercive measures 2.3 per art. 113 plus procedural risks and liberty situations, alternative outcomes 2.4, circumscriptions with Colegio de Jueces and seat) from versioned YAML under `backend/src/main/resources/jurisdictions/neuquen/`. Each item keeps its CPP article and its `[validar]`/`[no verificado]` flag. Firms can rename, hide or add items per tenant; the source article is preserved. | backend | T07, gate:domain | done (#18) |
| T11 | Persons and clients: one record per person (human or legal), roles per case (incl. victim with notification rights, art. 61, and institutional complainant, art. 65), client relationship with authorized contacts and data-processing consent, simple conflict-of-interest alert by document number, optional "belongs to an indigenous people" field on defendants `[validar]`. Sensitive data and person-to-person relationships are **out of the MVP** (Ley 25.326). Links to cases and the indigenous field moved to T12 (ADR-0014). | backend | T07, gate:domain | done (#20) |
| T12 | Case (legajo) and defendants (imputados): case has caption, MPF legajo (format `MPF`+seat+number/year), OFIJU and Pehuén numbers `[validar]`, circumscription, action type (public, private-instance, private: arts. 99–101), parties, team, reserved flag. **Stage, status, charges-formulation date, defence counsel, rebellion (art. 52) and final outcome live on each defendant, not on the case**; the case shows a computed summary (most delayed stage, detainees, next hearing). Charges kept simple. No criminal-record field (Ley 25.326 art. 7). Also from T11 (ADR-0014): the case-party link (person + `party-roles` code), the conflict check extended to case roles, and the optional "belongs to an indigenous people" field on the defendant `[validar]` (ethnic origin is sensitive data, art. 2). | backend | T10, T11 | done (#22) |
| T13 | Hearings (audiencias): type from catalog (with CPP article), date/time, room, judge, OFIJU reference, who requested it, defendants involved, OFIJU status (requested, scheduled, rescheduled, effective, reconverted, recess/continuation, suspended, cancelled) and cancellation reason, result with next hearing, rescheduling history, schedule-clash detection per lawyer; agenda queries by day/week/lawyer. Coercive measures per defendant (the 7 of art. 113, preventive detention with fixed duration and review, detainee alerts). | backend | T12 | done (#23) |
| T14 | Deadline rule engine (Opus): the 13 rules marked "Sí" in `neuquen-review.md` §3, **built in and not user-editable** (firms may only disable a rule or change its alerts). Each rule stores: article, trigger, duration, computation type per art. 79 (continuous hours, business days with a Neuquén court-holiday calendar, calendar days for precautionary measures, calendar months/years), legal consequence, case-law status (short text + link + review date), allowed extensions (count, who grants, max), suspending events (rebellion, penal mediation, federal extraordinary appeal), scope (defendant or case), legal vs judicial deadline. Concrete deadlines store granted extensions and the hearing that granted them; judicial deadlines are entered by hand. Every due date shows rule, article and "Cálculo asistido: verificá con la norma"; detainee deadlines first. Rules from arts. 156–272 carry `[no verificado]`. Exhaustive unit tests per computation type. | backend | T12, gate:domain | done (#24) |
| T15 | Custom fields, MVP scope only: on case and defendant, 5 types (text, number, date, yes/no, list), JSONB + per-tenant schema. Templates per case type and other entities are deferred. | backend | T12 | done (#25) |
| T16 | CSV/Excel import of cases, persons and hearings with preview and validation report. | backend | T12 | todo |

## Milestone 2: Product UI (after stage 2)

| ID  | Task | Owner | Needs | Status |
|-----|------|-------|-------|--------|
| T19 | Visual direction (stage 2): using the frontend-design skill, research references (Clio, MyCase, Filevine, Smokeball; serious, calm, fast; clear for a 70-year-old lawyer, appealing to a 30-year-old), produce 2–3 directions as static mockups of the hearing agenda (mobile 390x844 and desktop 1440x900, fictitious data, Rioplatense Spanish), pick the best with written reasons (legibility, AA contrast, density on mobile, brand seriousness) and write `docs/design/DESIGN.md` with `status: approved` (palette, typography, spacing, radius, iconography, motion, tone of voice, do/don't) plus the mockup screenshots under `docs/design/`. Record the choice as an ADR. | frontend | T03 | todo |
| T20 | Design system in code: tokens, typography, color, shadcn theme, base components, light/dark, documented in `docs/design/`. | frontend | T03, gate:design | todo |
| T21 | App shell: login + 2FA, navigation (mobile bottom nav, desktop sidebar), firm switcher. | frontend | T20, T06 | todo |
| T22 | Agenda de audiencias (home): today / week, by lawyer, mobile-first. | frontend | T21, T13 | todo |
| T23 | Case list and case detail. | frontend | T21, T12 | todo |
| T24 | Deadlines view with source and disclaimer. | frontend | T21, T14 | todo |
| T25 | Settings: catalogs, custom fields, templates, users and roles. | frontend | T21, T15 | todo |
| T26 | Import wizard. | frontend | T21, T16 | todo |
