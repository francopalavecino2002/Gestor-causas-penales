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
- Design system in code (T20): Limay tokens for light and dark in `index.css`, mapped to the shadcn
  theme, with a product type scale that cannot go below 15 px. Self-hosted Atkinson Hyperlegible Next
  and lucide icons. Theme provider with system default, live system changes and a saved choice,
  applied before first paint. Base components (button, input, textarea, native select, label, field,
  checkbox, switch, card, badge, alert, dialog, tooltip, separator, skeleton, tabs), a hearing-status
  badge and the "Cálculo asistido" note. Living style guide at `/design-system`, a token contrast
  test, and `docs/design/COMPONENTS.md` (ADR-0021).
- App shell (T21): login at `/ingresar` with the optional second step (TOTP or recovery code),
  CSRF-aware API client with problem+json errors, route guard and session-expiry handling,
  bottom nav on phones and sidebar on desktop, account menu, and a firm switcher that remembers
  firms used on the device and signs in again to switch (ADR-0022).
- Hearing agenda as the home (T22): day view on a rail with the "Ahora" line and finished
  hearings collapsed, week view grouped by day with sticky day headers on phones and a denser
  row layout on desktop, filter by lawyer, view/date/lawyer kept in the URL, detainee alerts
  with legal source and disclaimer, "Persona detenida" and "Superposición de horario" markers,
  times in the firm's time zone, skeleton, empty and error states (ADR-0023).
- Case list and case detail (T23): `/causas` with search, archived toggle and pagination kept in
  the URL, cards on phones and a table on desktop, detainee and reserved markers; read-only
  `/causas/$caseId` with summary, case numbers, defendants (liberty situation, stage, counsel,
  rebellion, charges), parties, team and hearings; agenda hearings link to their case (ADR-0024).
- Deadlines view (T24): `/plazos` groups overdue, due-soon, running and not-calculable deadlines,
  detainees first, with a horizon (7/15/30/60 days) and a detainees-only switch kept in the URL;
  every card shows the legal source with its review tags, the due date, the time left and the
  "Cálculo asistido" disclaimer. The case detail gets a "Plazos" section (ADR-0025).
- Settings (T25): `/ajustes` with catalogs (rename, hide, add firm items; article and review tags
  kept), custom fields for cases and defendants (create, edit, archive, restore), deadline-rule
  settings (on/off and warning days, source and disclaimer visible) and a read-only users and roles
  page. Changes are for the titular only; templates and user management come later (ADR-0026).
- Import wizard (T26): `/importar` guides owners and lawyers through choosing persons, cases or
  hearings, downloading the template, uploading a .csv/.xlsx, reviewing a dry-run validation report
  row by row and confirming explicitly before anything is saved. Reachable from settings and the
  empty case list (ADR-0027).
- Rich demo dataset (T30): the `demo` profile now seeds 25 fictitious cases for three lawyers across
  every stage, multi-defendant cases, a full week of the most frequent hearing types on weekdays,
  two detainees with deadlines due within 48 h, a suspension of trial on probation, a mediation, a
  jury trial, closed cases and visible `[validar]` items, all relative to today (ADR-0028).
- One-command local demo (T31): `scripts/demo.ps1` and `scripts/demo.sh` start Postgres, recreate a
  dedicated `gestor_demo` database, run the backend with the `dev,demo` profiles and the frontend,
  wait for health, open the login with the demo firm prefilled and print the users and password.
  The app is also served on the LAN IP for a phone on the same Wi-Fi; in that mode the session and
  CSRF cookies drop `Secure`, now driven by one property. Guide in Spanish in `docs/DEMO.md`; CI
  lints the demo scripts (ADR-0029).
- End-to-end demo flow (T32): a Playwright suite in `frontend/e2e-demo/` drives the real backend
  with the fictitious seed: login with password and TOTP, today's agenda and the week (desktop and
  phone) with the lawyer filter, finding and opening a case, a detained defendant's deadlines with
  their legal source and the assisted-calculation disclaimer, and a CSV import of people with its
  error report. `scripts/e2e-demo.sh` runs it on a fresh `gestor_e2e` database; CI runs the same
  script in a new `e2e-demo` job.
- Demo script and visual QA (T33): `docs/DEMO.md` gains a timed 10-minute guided script in Spanish
  with talking points per screen and the open questions for the lawyer. 20 screens of the real demo
  are captured at 390x844 and 1440x900 into `docs/screenshots/demo/` with
  `bash scripts/e2e-demo.sh --screenshots`. The visual review fixed four issues: on phones the agenda
  shows one detainee alert and "Mirá los N avisos", deadline cards show their notes, the case table
  says "Sin cargar" on one line, and the empty state for custom fields spans the full width.
- Portfolio polish (T34): the README now presents the demo-ready prototype with an animated GIF of
  the demo flow (`npm --prefix frontend run demo:gif`, built from the demo screenshots), a screenshot
  gallery, an updated architecture diagram, test counts per suite, a backend coverage badge and a
  "Cómo se construyó" section about the agent workflow. The backend build measures line coverage
  with JaCoCo; CI writes it to the job summary and uploads the report as an artifact (ADR-0030).
- Create and edit forms (T35): "Nueva causa" (with an optional first defendant), "Editá la causa",
  "Agregá un imputado", "Nueva audiencia" from the agenda and the case detail, and "Editá" on
  hearings, built with React Hook Form + Zod in one mobile-first form sheet. Server errors are mapped
  to their field, schedule clashes are shown after saving without blocking, and changing a hearing's
  date goes through rescheduling with a reason. New `GET /api/v1/users` lists the firm's active
  members for the lawyer pickers (ADR-0031).
- Practice-area design (T40): every practice area (penal, civil, laboral, familia) is a configuration
  package inside the jurisdiction, with criminal concepts as modules of the criminal area (ADR-0032).
- Practice-area packages (T41): the Neuquén criminal catalogs and deadline rules moved to
  `jurisdictions/neuquen/penal/` with an `area.yml` manifest and modules; cases carry
  `practiceArea` (existing ones migrated to `penal`), firms have enabled areas, catalogs are served
  and customized per area (`?area=`, default `penal`), every code is validated against the case's
  area, and criminal-only features answer 409 for other areas. New `GET /api/v1/practice-areas`.
- Non-criminal cases (T42): basic Neuquén civil, laboral and familia packages (all flagged `[validar]`,
  only a generic court-set deadline rule), action type and represented side as catalog codes of the
  case's area (V13), a case-level stage, status and closing outcome for areas without defendants,
  and an optional `fuero` column in the cases import. The criminal wire format and the demo are unchanged.
- Optional AI assistance (T52): off by default per firm and per installation, "Completá desde una
  notificación" fills the new-hearing form from a pasted OFIJU/SINE text through a replaceable provider
  (Gemini), with the answer checked against the firm's catalogs and the text never stored (ADR-0033).
- Practice areas in the UI (T43): area choice in "Nueva causa", case detail and forms driven by the
  area's modules (defendants, detainees, MPF legajo), area badges and filters in the case list and the
  agenda when more than one area is enabled, a "Fueros" section in Ajustes (owner only, audited, with
  a row lock against concurrent changes) and per-area catalog settings. The case API now uses plain
  catalog codes. Penal-only firms see the same screens as before.
- Agenda export (T44): a private iCalendar feed (RFC 5545) of the hearings each member attends, behind
  a revocable 256-bit secret stored only as its SHA-256 (`/api/v1/me/calendar-feed`, public
  `GET /api/v1/calendar-feed/{secret}.ics`), and a one-hearing download
  (`GET /api/v1/hearings/{id}/calendar.ics`). Defendants, notes and results never leave; reserved
  cases show "Causa reservada" without caption, judge or OFIJU reference (ADR-0034).
