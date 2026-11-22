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
- Jurisdiction packages (T10): the Neuquén catalogs (stages and closing outcomes, hearing types
  ordered by 2014 frequency, hearing statuses and cancellation reasons, coercive measures of art. 113,
  procedural risks, liberty situations, alternative outcomes, circumscriptions) ship as versioned
  YAML validated at startup, each item with its legal source and its `[validar]`/`[no verificado]`
  flag. Firms rename, hide or add items per catalog policy without losing the original name and
  article; changes are audited. `GET /api/v1/catalogs`, `GET /api/v1/catalogs/{catalog}`,
  `POST /api/v1/catalogs/{catalog}/items`, `PUT /api/v1/catalogs/{catalog}/items/{code}` (ADR-0013).
- Persons and clients (T11): one record per person (human or legal entity) and normalized document,
  searchable by name, alias or document; clients with intake data and consent to data processing;
  authorized contacts with what the firm may tell them; a conflict-of-interest alert by document
  number that matches a DNI against a CUIT/CUIL; the `party-roles` catalog (víctima with notification
  rights, art. 61; querellante institucional, art. 65). Archive and restore instead of delete,
  audited, tenant-isolated. No sensitive data, relations between persons or free-text notes
  (Ley 25.326). `/api/v1/persons`, `/api/v1/clients` (ADR-0014).
