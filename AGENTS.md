# AGENTS.md

Instructions for coding agents (OpenCode and others) working in this repository.
The orchestrator (Claude Code) gives you one focused task at a time. Do that task only.

## Rules

- Work only inside the paths named in your task. Do not touch `.claude/`, `.github/`,
  `CLAUDE.md`, `AGENTS.md` or `ROADMAP.md`.
- Do **not** run `git commit`, `git push` or any git command that changes history. The
  orchestrator commits.
- Never add secrets, API keys or real personal data. All data is fictitious.
- Do not claim tests pass unless you ran them and saw the output. If you could not run them,
  say so explicitly.
- When finished, print a short summary: files changed, commands run, and their real result.

## Backend conventions (`backend/`)

- Java 21, Spring Boot, Maven wrapper (`./mvnw`). Lombok is allowed for boilerplate only
  (`@Getter`, `@RequiredArgsConstructor`, `@Builder`); prefer records for DTOs.
- Package by feature: `ar.gestorpenal.<feature>` with `web`, `application`, `domain`,
  `persistence` subpackages when useful.
- Every table has `id uuid`, `tenant_id uuid not null`, `created_at`, `created_by`,
  `updated_at`, `updated_by`, `archived_at` (nothing is deleted).
- Migrations: Flyway, `src/main/resources/db/migration/V<n>__<snake_case>.sql`.
  Never edit a migration that already exists on `main`; add a new one.
- Custom fields live in a `jsonb` column `custom_fields`.
- REST: `/api/v1/...`, JSON, errors as RFC 9457 problem details.
- Tests: JUnit 5 + AssertJ; integration tests with Testcontainers PostgreSQL.
  Name tests by behavior: `shouldRejectHearingOutsideTenant()`.
- Ports: app 8081, PostgreSQL 5434 (docker compose). Never 5432, 5433 or 8080.

## Verify before you finish

```bash
cd backend && ./mvnw -B verify
```
