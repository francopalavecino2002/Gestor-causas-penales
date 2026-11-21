# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Toolchain check (T00): free OpenCode models configured, results recorded in ADR-0003.
- Backend skeleton (T01): Spring Boot 4.2 on Java 21, Flyway, deny-by-default security with public
  health check, Testcontainers integration tests, Docker Compose Postgres on port 5434 (ADR-0004).
- CI workflow (T02): backend and frontend jobs run only when their folder exists and, on PRs, changed;
  shell script syntax check; CI badge in the README (ADR-0005).
- Frontend skeleton (T03): Vite 8 + React 19 + TypeScript, Tailwind CSS v4, shadcn/ui, TanStack
  Router and Query, Vitest and Playwright smoke tests, installable PWA with Spanish manifest, `/api`
  proxied to the backend on 8081, placeholder home "Gestor de causas penales" (ADR-0006).
- Multi-tenancy foundation (T04): `tenant` table and `TenantScopedEntity` with Hibernate `@TenantId`.
  The tenant is resolved from the authenticated user or an explicit scope and fails closed when
  missing. Isolation and schema-convention tests are included (ADR-0007).
- Authentication (T05): per-firm users with roles (titular, abogado, procurador, administrativo),
  bcrypt passwords, session-cookie login with SPA CSRF protection, session-id and CSRF-token
  rotation on login, generic problem+json errors, failed-login throttling per account and per client,
  `POST /api/v1/auth/login`, `POST /api/v1/auth/logout`, `GET /api/v1/me` (ADR-0008).
- Two-factor authentication (T06): opt-in TOTP (RFC 6238) for any authenticator app, with password-
  confirmed enrollment, secrets encrypted at rest with AES-256-GCM (`TOTP_ENCRYPTION_KEY`), replay
  protection, 10 single-use recovery codes, a two-step login (`202` then
  `POST /api/v1/auth/login/second-factor`) that shares the login throttle, and
  `/api/v1/me/two-factor` endpoints to enroll, regenerate codes and disable (ADR-0009).
- Audit log (T07): append-only, tenant-scoped change history (who, when, entity, field, old and new
  value) recorded by Hibernate listeners for `@Audited` entities, with redacted secrets and
  `ARCHIVE`/`RESTORE` actions; deleting entities is rejected so records are archived instead
  (ADR-0010).
- Demo data (T08): the `demo` profile seeds a clearly fictitious firm (`estudio-demo`) with an
  owner, a lawyer and a paralegal; resumable, password from `DEMO_PASSWORD` with no default
  (ADR-0011).
- Portfolio README (T09): product pitch, Mermaid architecture diagram, stack, how to run and test
  locally, key technical decisions linked to their ADRs, and a screenshots section (ADR-0012).
