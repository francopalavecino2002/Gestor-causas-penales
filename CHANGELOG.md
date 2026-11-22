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
- Case file and defendants (T12): cases with caption, normalized MPF legajo (unique per firm),
  OFIJU and Pehuén numbers `[validar]`, circumscription, action type (arts. 99–101) and who the
  firm represents; stage, status, outcome, charges date (art. 133), defence counsel and rebellion
  (art. 52) on each defendant, with a computed summary on the case; simple charges; parties by
  `party-roles`; case team with one responsible; reserved cases visible only to their team and the
  owner; conflict check lists case roles and masks reserved cases; optional "pueblo indígena" field
  redacted in the audit log `[validar]`; archived cases and defendants are read-only until restored.
  No criminal-record field. `/api/v1/cases` (ADR-0015).
- Hearings and coercive measures (T13): hearings on a case with type (catalog, with CPP article),
  date, duration, room, judge, OFIJU reference, who requested it, defendants and attending lawyers;
  OFIJU status and cancellation reason; result with an optional linked next hearing; rescheduling
  history; schedule-clash warnings per lawyer (reserved cases masked); agenda by day, range and
  lawyer in Neuquén local time; coercive measures per defendant (art. 113) with preventive detention
  duration and review, rejected on private action (art. 115); detainee alerts (arts. 116, 118, 119)
  marked "Cálculo asistido: verificá con la norma"; detainees and next hearing in the case summary.
  `/api/v1/agenda`, `/api/v1/hearings`, `/api/v1/detainee-alerts` (ADR-0016).
- Deadline rule engine (T14): the 13 MVP deadline rules of Neuquén plus a generic judicial deadline,
  built into the jurisdiction package (`deadline-rules.yml`, validated at startup) with article,
  trigger, art. 79 computation (continuous hours, business days on a Neuquén court calendar for
  2025–2027 `[validar]`, calendar days, calendar months and years, dates set by the court), legal
  consequence, case-law status with link and review date, chained extensions, suspending events
  (rebellion from the defendant, penal mediation and the federal extraordinary appeal loaded on the
  case), scope (defendant or case) and review flags (`[no verificado]` for arts. 156–272). Firms can
  only disable a rule or change its warning. Due dates are computed on read, detainee deadlines first,
  each with its source and "Cálculo asistido: verificá con la norma". `/api/v1/deadline-rules`,
  `/api/v1/court-calendar`, `/api/v1/cases/{id}/deadlines`, `/api/v1/deadlines`,
  `/api/v1/cases/{id}/deadline-suspensions` (ADR-0017).
- Custom fields (T15): the firm owner defines fields for cases and defendants of five types (text,
  number, date, yes/no, list) with an immutable key generated from the label, list options that are
  renamed or hidden but never removed, a required flag and an order. Values live in a `jsonb` column
  on each record, are validated against the firm's definitions, survive archiving a definition and
  appear in the audit history. `/api/v1/custom-fields`, `customFields` on cases and defendants
  (ADR-0018).
- CSV/Excel import (T16): owners and lawyers load persons, cases with their defendants, and hearings
  from `.csv` (`;` or `,`, UTF-8) or `.xlsx` files with Spanish headers. A dry run returns a per-row
  validation report; a commit is all or nothing. Rows go through the regular services, so catalogs,
  duplicates, tenant isolation, reserved cases and the audit log apply as in the API. Nothing of the
  file is stored. `POST /api/v1/imports/{kind}` and a downloadable template per kind (ADR-0019).
- Visual direction (T19): three static mockups of the hearing agenda at mobile and desktop sizes,
  with direction A "Limay" approved in `docs/design/DESIGN.md`. It specifies light and dark tokens
  under shadcn names, Atkinson Hyperlegible Next with a 15 px floor, spacing, radius, lucide icons,
  reduced motion, and the Rioplatense tone of voice. `scripts/contrast.mjs` checks every token pair
  against WCAG AA (ADR-0020).
