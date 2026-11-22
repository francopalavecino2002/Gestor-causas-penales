# Architecture Decision Records

Short, append-only log. Each entry: context, decision, consequences. Newest at the bottom.
Superseded decisions are marked, never deleted.

## ADR-0001: Autonomous, agent-driven development workflow

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** One developer (junior), limited time, a Claude subscription and free models
  available through OpenCode. The repository must stay presentable as a portfolio piece.
- **Decision:**
  - Claude Code is the orchestrator. `ROADMAP.md` is the task queue; `/next-task` runs one
    task end to end (branch, delegate, verify, review, PR, merge).
  - Backend code is written first by OpenCode with free models (rotated), always verified by
    re-running `./mvnw verify`; escalation to Sonnet, then Opus for hard problems.
  - Frontend is written by Claude with the frontend-design skill and checked with Playwright
    screenshots.
  - Every change lands through a squash-merged PR with Conventional Commit title, template
    (what / why / how to test / screenshots) and green CI.
  - Headless runs use `--permission-mode dontAsk` with an allowlist in `.claude/settings.json`:
    anything not explicitly allowed is denied instead of prompting.
  - Human gates (`gate:domain`, `gate:design`) stop the loop before work that depends on
    unvalidated legal research or an unapproved visual direction.
- **Consequences:** Progress happens in batches limited by subscription usage. Quality depends
  on verification, so verification commands are mandatory and never skipped.

## ADR-0002: Frontend stack

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** The frontend is written by Claude and must look polished and work as a PWA.
  The developer knows Angular; React has the richer ecosystem of high-quality components.
- **Decision:** React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query /
  Router / Table, Motion. Chosen by Franco on 2026-11-21.
- **Consequences:** The portfolio shows both Angular (previous project) and React.

## ADR-0003: Toolchain check (T00)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** The autonomous loop depends on local tools; verify them before building.
- **Results:**
  - OpenCode 1.19.4; `opencode run --help` works; `opencode.json` is accepted (`opencode debug config`
    resolves it without errors).
  - `gh` logged in with scopes `repo`, `read:org`, `gist`.
  - Docker Compose v5.2.0, JDK Temurin 25.0.3 (Maven target stays Java 21), Node v22.23.4.
- **Decision:** `.claude/opencode-models.txt` lists three free models, in order:
  `opencode/deepseek-v4.1-flash-free`, `opencode/longcat-2.5-free`, `opencode/mimo-v2.6-flash-free`.
  Chosen from the `-free` entries of `opencode models` by name only; their coding quality was not
  benchmarked, so the rotation plus mandatory re-verification (ADR-0001) is the safety net.
- **Consequences:** If these models disappear from OpenCode, re-run `opencode models` and update the file.

## ADR-0004: Backend skeleton baseline (T01)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** First backend code. Versions checked on Maven Central / postgresql.org on 2026-11-21.
- **Decision:**
  - Spring Boot **4.2.0** (modular starters: `spring-boot-starter-webmvc`, `-flyway`, `-webmvc-test`...),
    Java 21 target, Hibernate 7.4, Testcontainers **2.0.5** (managed by the Boot BOM), Lombok **1.18.48**
    declared in `annotationProcessorPaths`.
  - Maven wrapper 3.3.4 in `only-script` mode with Maven 3.10.1, so no wrapper jar is committed.
  - PostgreSQL image `postgres:18-alpine` for both Compose and Testcontainers. PostgreSQL 19 was
    released on 2026-11-19; we wait for its first minor before moving.
  - Base package `ar.gestorpenal` (from `AGENTS.md`).
  - Security baseline: stateless, deny by default, only `/actuator/health/**` public; unauthenticated
    requests get a plain 401. CSRF is disabled because no cookie-based auth exists yet; T05 must
    re-enable it if credentials ever travel in cookies. problem+json error bodies are deferred to T05,
    when the first real endpoints and auth errors appear.
  - The main `application.properties` has no datasource defaults (startup fails loudly without
    `DB_URL`/`DB_USERNAME`/`DB_PASSWORD`); local defaults live in the `dev` profile. Compose binds
    Postgres to `127.0.0.1:5434` only.
- **Consequences:** Run locally with `./mvnw spring-boot:run -Dspring-boot.run.profiles=dev`.
  Tests do not need any env vars thanks to `@ServiceConnection`.

## ADR-0005: CI workflow (T02)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** Backend and frontend live in one repository; the frontend does not exist yet.
  PRs that only touch one stack should not wait for the other. Action versions checked on their
  GitHub release pages on 2026-11-21.
- **Decision:**
  - One workflow, `.github/workflows/ci.yml`, with a `changes` job that decides which stacks run.
    A stack runs only if its marker file exists (`backend/pom.xml`, `frontend/package.json`) and, on
    pull requests, only if its folder or the workflow itself changed (`dorny/paths-filter@v4`).
  - Pushes to `main` and manual runs (`workflow_dispatch`) build every existing stack, so the README
    badge always reflects the whole repository.
  - Actions pinned to major tags: `actions/checkout@v7`, `actions/setup-java@v6`,
    `actions/setup-node@v7`. Least-privilege `permissions` (read-only) and per-job timeouts.
  - A `repo-hygiene` job syntax-checks every `scripts/*.sh`.
- **Consequences:** Skipped jobs report as "skipped", which GitHub treats as passing for required
  checks. When branch protection is configured, require `changes` and `repo-hygiene` plus the stack
  jobs.

## ADR-0006: Frontend skeleton baseline (T03)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** First frontend code (stack chosen in ADR-0002). Versions checked on the npm registry
  on 2026-11-21. No visual design yet (`gate:design`).
- **Decision:**
  - Vite **8.3**, React **19.3**, Tailwind CSS **4.3** via `@tailwindcss/vite`, shadcn/ui (neutral
    base color), TanStack Router **1.170** and Query **5.108**, Vitest **5.1**, Playwright **1.65**,
    ESLint **10** + typescript-eslint **8.73**, Prettier **3.10**, vite-plugin-pwa **2.0**.
    Node >= 22.12 (required by Vite 8).
  - TypeScript is pinned to **~6.0**, not 7.0: typescript-eslint 8.73 supports up to 6.0. TS 6
    deprecates `baseUrl`, so the `@/` alias uses `paths` only, mirrored in Vite's `resolve.alias`.
  - **Code-based routing** in `src/router.tsx` (`createAppRouter({ history })` so tests use memory
    history). File-based routing (router plugin + generated route tree) is reconsidered once there
    are many screens.
  - Vitest config lives in `vite.config.ts` (jsdom, only `src/**/*.test.tsx`); no test globals,
    jest-dom matchers imported in the setup file.
  - Playwright runs against the production build (`build` + `preview` on 4173) so the manifest and
    service worker are exercised; CI runs it after the build. Dev server stays on 5173 (`strictPort`).
    The service worker never serves the SPA shell for `/api/` navigations.
  - PWA: `registerType: "autoUpdate"`, manifest in Spanish (`lang: "es-AR"`), placeholder icons
    generated from `public/favicon.svg`, to be replaced by the design system (T20).
  - `npm audit` reports 4 moderate advisories in `glob`/`minimatch` pulled by `workbox-build`
    (build-time only, nothing shipped). The only offered fix is downgrading vite-plugin-pwa; accepted.
- **Consequences:** `npx shadcn add` may write a wrong `cn` import (`from "cn"`) because there is no
  `baseUrl`; check the import after adding components.

## ADR-0007: Multi-tenancy with Hibernate `@TenantId` (T04)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** Every firm (estudio) shares one database and one schema. Criminal-record data is
  sensitive (Ley 25.326, art. 7), so a missing `WHERE tenant_id = ?` must not leak data. The options
  were PostgreSQL row-level security (RLS), Hibernate filters, and Hibernate's `@TenantId`
  discriminator.
- **Decision:**
  - **Shared schema, `tenant_id uuid NOT NULL REFERENCES tenant(id)` on every business table.**
    The `tenant` table and `flyway_schema_history` are the only global tables.
  - **Hibernate 7 `@TenantId`** on a `TenantScopedEntity` mapped superclass. Hibernate stamps the
    tenant on insert and adds the restriction to every entity load, HQL/JPQL query, and bulk
    update/delete. Unlike `@Filter`, it cannot be forgotten or switched off per session, and unlike
    hand-written predicates it covers `findById`.
  - **Tenant resolution** (`CurrentTenantResolver`): an explicit `TenantContext.runAs(...)` scope (seed
    data, jobs, tests) wins, then the authenticated principal implementing `TenantPrincipal`. The
    tenant always comes from the logged-in user (T05), never from a header or a request parameter.
  - **Fail closed:** with no tenant resolved, the resolver returns the nil UUID. A check constraint
    forbids that id in `tenant`, so tenant-scoped queries return nothing and inserts fail on the
    foreign key. No tenant is "root".
  - A scope cannot be entered inside a running transaction (the Hibernate session is already bound
    to a tenant). `TenantContext` throws instead of silently using the wrong tenant.
  - Guard tests: every table outside the global list must have a non-null `tenant_id` foreign key to
    `tenant`, and every entity except `Tenant` must extend `TenantScopedEntity`.
  - **RLS was not adopted yet.** It is the stronger guarantee, but superusers and table owners bypass
    it. It needs a separate non-owner runtime role, a `set_config('app.tenant_id', ...)` call per
    transaction, and role provisioning in Compose, Testcontainers and CI. The schema already has
    `tenant_id` on every table, so RLS policies can be added later as defense in depth without data
    changes.
- **Consequences:** Native SQL and `JdbcTemplate` bypass `@TenantId`. Business code must use JPA, and
  any native query must filter by tenant explicitly and get an isolation test. Unique constraints
  on business tables should include `tenant_id` (for example `(tenant_id, internal_number)`).
  Test-only tables live in `src/test/resources/db/testmigration` as repeatable migrations.
  `TenantRepository` is package-private, because it is the only cross-tenant read path. The
  explicit scope is thread-bound and is not propagated to async or scheduled work, which fails
  closed. Archiving tenants and audit columns (`updated_at`, change history) belong to T07.

## ADR-0008: Authentication with a server session, CSRF and per-firm users (T05)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** The client is a same-origin PWA (Vite proxies `/api` in development). Sessions must
  be revocable: a fired paralegal or a stolen phone has to be cut off. Users belong to a firm, and
  `@TenantId` (ADR-0007) makes every user lookup tenant-scoped.
- **Decision:**
  - **Server-side HTTP session, not JWT.** The session cookie `GP_SESSION` is `HttpOnly`,
    `Secure` and `SameSite=Lax`, with a 30-minute idle timeout and a 12-hour absolute lifetime
    (`app.security.session.max-age`). Logging out invalidates it on the server, which a stateless
    JWT cannot do without a denylist. Chrome and Firefox accept `Secure` cookies on
    `http://localhost`, so development needs no TLS. Safari does not, so use Chrome or Firefox locally.
  - **Every request re-checks the user** (`ActiveUserFilter`, one primary-key lookup). If the
    user was archived, their role changed, or the absolute lifetime is over, the session is
    invalidated and the request is treated as anonymous (401).
  - **CSRF is on again** (it was off in ADR-0004 because there were no cookies), using Spring Security's
    SPA mode: the `XSRF-TOKEN` cookie is readable by JavaScript and the SPA sends it back in the
    `X-XSRF-TOKEN` header. `GET /api/v1/auth/csrf` issues the cookie. The login itself needs the
    token (login CSRF).
  - **Login** is `POST /api/v1/auth/login` with `{tenant, email, password}`, where `tenant` is the firm's
    slug ("estudio"). The firm is resolved first and the user is looked up inside its
    `TenantContext`, so a login never reads across tenants and no global user table is needed. The
    same email can exist in two firms as two accounts. On success, the session id is changed
    (against session fixation) and the CSRF token is rotated. The response is 204, and the SPA then
    calls `GET /api/v1/me`. Logout is `POST /api/v1/auth/logout` and returns 204.
  - **One generic failure.** Unknown firm, unknown or archived user, a password longer than bcrypt's
    72 bytes and a wrong password all return the same 401 problem. Unknown users are checked
    against a dummy hash, so the response time does not reveal which accounts exist.
  - **Passwords:** bcrypt (cost 10) behind a `DelegatingPasswordEncoder`, so hashes are stored as
    `{bcrypt}...`, and Argon2 can be added later without a migration. Argon2 would need BouncyCastle.
    Policy: at least 12 characters, at most 72 bytes.
  - **Rate limiting:** an in-memory sliding window. Each account (firm + email) gets 5 failures and each
    client address gets 20 failures per 15 minutes (configurable under `app.security.login.*`).
    Over the limit, every attempt gets 429 with `Retry-After`, even with the right password. Each
    attempt is reserved atomically before the password is checked, so parallel requests cannot get
    extra guesses, and a success refunds it. At most 50,000 keys are tracked, and the least recently
    used are evicted first. No library was added: Bucket4j would be needed only with several instances.
  - **Roles:** `OWNER`, `LAWYER`, `PARALEGAL`, `ADMIN_STAFF`, one per user, exposed as `ROLE_*`.
  - **Errors are problem+json** (`spring.mvc.problemdetails.enabled`). The security filters delegate
    their 401/403 responses to the same `@RestControllerAdvice`, so the body shape is the same everywhere.
    `type` values are stable relative identifiers (`/problems/invalid-credentials`...) for the client
    to switch on. Nothing serves a page at those paths.
  - Spring Boot's default in-memory user (`UserDetailsServiceAutoConfiguration`) is excluded.
- **Consequences:**
  - Sessions and throttle counters live in memory: a restart logs everyone out and resets the
    counters. Before running more than one instance, move sessions to Spring Session JDBC (a new
    global table) and the counters to a shared store.
  - Behind a reverse proxy, client addresses and `Secure` detection need
    `server.forward-headers-strategy` set. Otherwise every request seems to come from the proxy and
    the per-client limit applies to all users together.
  - Accepted trade-off of lockout-style throttling: anyone who knows a firm slug and an email
    can keep that account locked by failing 5 times every 15 minutes. If it becomes a problem, add
    a counter keyed by account and client, so the owner's usual address stays allowed.
  - Flooding the throttle with more than 50,000 distinct keys could evict a victim's counter. The
    per-client limit makes that require thousands of addresses.
  - A person working for two firms has two accounts. The firm switcher (T21) logs in again.
  - `TenantService` is the public entry point to tenants: create, resolve a slug, describe one firm.
    It never lists tenants.

## ADR-0009: Two-factor authentication with TOTP and recovery codes (T06)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** Lawyers log in from phones that get lost and from shared office computers, and the
  data is criminal-record data (Ley 25.326, art. 7). A second factor must work with any common
  authenticator app, without SMS (cost, SIM swapping) and without a third-party service.
- **Decision:**
  - **TOTP (RFC 6238)** with the parameters every app supports: HMAC-SHA1, 6 digits, 30-second
    steps, one step of drift accepted on each side. Implemented in ~100 lines on top of the JDK
    (`Totp`, `Base32`) and tested against the RFC 6238 and RFC 4648 vectors. No library was added:
    the algorithm is small and stable, and the common Java libraries add QR or HTTP dependencies we
    do not need. The SPA will draw the QR code from the `otpauth://` URI.
  - **Opt-in per user for now.** A firm-wide "2FA required" policy is left for the settings screen
    (T25); `/api/v1/me` exposes `twoFactorEnabled` so the UI can nudge users.
  - **Enrollment in two steps.** `POST /api/v1/me/two-factor/enrollment` with `{password}` returns a
    new secret and its URI; 2FA stays off until `POST .../enrollment/confirm` receives a valid code,
    so a user who abandons the setup is never locked out. Confirming returns **10 recovery codes**,
    shown once. `GET /api/v1/me/two-factor` returns `{enabled, recoveryCodesRemaining}`.
  - **Secrets encrypted at rest** with AES-256-GCM (`TotpSecretCipher`). The key comes from
    `TOTP_ENCRYPTION_KEY` (32 bytes in base64), has no default outside the `dev` profile, and the
    app refuses to start without it. The user id is authenticated data, so a ciphertext copied to
    another row does not decrypt. The stored value has a `v1:` prefix to allow key rotation later.
    Losing the key disables every enrolled second factor (users fall back to recovery codes or an
    admin reset, which does not exist yet).
  - **No replay.** `totp_last_step` stores the last accepted step. It is advanced with one
    conditional `UPDATE ... WHERE totp_last_step < :step`, so a code works once even when two
    requests race.
  - **Recovery codes** are 16 characters of Crockford base32 (80 random bits), shown as
    `XXXX-XXXX-XXXX-XXXX`, accepted in any case and with or without dashes. Only their SHA-256 is
    stored: with 80 bits of entropy a slow hash adds nothing, and lookups stay a single indexed
    query. Each code is consumed with a conditional update; regenerating archives the old set
    (`archived_at`), nothing is deleted.
  - **Two-step login.** When the password is right and 2FA is on, `POST /api/v1/auth/login` answers
    **202** with `{"status": "SECOND_FACTOR_REQUIRED"}` instead of 204. The old session is
    invalidated and a fresh one holds only a `PendingSecondFactor` (user, tenant, deadline of
    `app.security.two-factor.login-timeout`, 5 minutes); it has no security context, so every
    protected endpoint still answers 401. `POST /api/v1/auth/login/second-factor` with `{code}`
    (TOTP or recovery code) completes the login: new session id, new CSRF token, 204.
  - **Throttling.** Both login steps share the account's budget from ADR-0008: a valid password
    that still needs a code keeps its reserved attempt, and only a complete login refunds it (both
    the password's and the code's attempts, so many 2FA logins behind one office NAT do not fill the
    per-client budget). So an attacker who knows the password gets at most four code guesses per
    15 minutes. The
    authenticated actions that check a code or password (confirm, regenerate, disable) use the same
    throttle under a per-user key.
  - **Changing 2FA needs proof.** Starting an enrollment needs the password; regenerating recovery
    codes needs a current code; disabling needs the password and a code. A stolen session alone
    cannot bind the account to another phone, read new codes or turn 2FA off.
  - **Errors** (problem+json): `invalid-second-factor` and `second-factor-expired` (401) in the
    login; `invalid-confirmation` (422, not 401, because the session is still valid) and
    `two-factor-state` (409) in the settings.
- **Consequences:** The pending login lives in the in-memory session, with the same single-instance
  limits as ADR-0008. There is no admin reset of another user's 2FA yet; it needs the audit log
  (T07) and the user management screens (T25). Throttled settings actions answer with the generic
  `login-throttled` problem. Enabling or disabling 2FA does not end the user's other open sessions.
  Because each step is accepted once, the code used to confirm the enrollment cannot also be used
  to log in within the same 30 seconds; the user waits for the next code.

## ADR-0010: Change history with Hibernate event listeners, archive instead of delete (T07)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** Lawyers must be able to see who changed a hearing, a charge or a user's role, when,
  and what the value was before. The product rule is "nothing is deleted, it is archived". The
  options were Hibernate Envers (one `_aud` shadow table per entity), database triggers, and a
  generic event table filled by Hibernate listeners.
- **Decision:**
  - **One generic `audit_event` table**: firm, time, actor, entity type and id, action
    (`CREATE`, `UPDATE`, `ARCHIVE`, `RESTORE`) and the field differences as a JSONB array of
    `{field, oldValue, newValue}`. Values are stored as text and associations as the id of the
    associated record. A `bigint` identity gives a total order even inside one transaction.
  - **Opt-in per entity with `@Audited`**, all fields by default. `@AuditRedacted` keeps the fact that
    a secret changed (and whether it is set) without its value (password hash, TOTP secret);
    `@NotAudited` skips technical state (the TOTP replay step). `tenantId` is never recorded. An
    update that only touches skipped fields records nothing. `AppUser` is the first audited entity.
  - **Hibernate `PostInsert`/`PostUpdate` listeners** (`AuditRecorder`) instead of Envers or triggers.
    Envers would add a shadow table per entity, all of which need `tenant_id` and their own schema
    changes; triggers cannot know the logged-in user without a `set_config` per transaction and
    cannot see `@AuditRedacted`. The listener runs during the flush on the same connection, so
    the entry commits or rolls back with the change. It writes with plain JDBC because entities
    cannot be persisted in the middle of a flush; the `tenant_id` comes from the audited entity.
  - **The actor** is the authenticated principal when it implements `AuditActor`
    (`AuthenticatedUser`), and `NULL` for seed data and jobs. If the actor belongs to another firm
    than the changed record, the change is rejected instead of being attributed to an outsider.
  - **Reading** goes through the `AuditEvent` entity (`@Immutable`, tenant-scoped), so `@TenantId`
    filters it like any other entity: `AuditTrail.historyOf(entityClass, id)` and
    `AuditTrail.changesMadeBy(userId)`. No HTTP endpoint yet; it comes with the screens that show it.
  - **Append-only in the database:** triggers reject `UPDATE`, `DELETE` and `TRUNCATE` on
    `audit_event`, so not even a bug in the application can rewrite history.
  - **Archive instead of delete:** `DeletionGuard`, a `PreDelete` listener, throws
    `ArchiveInsteadOfDeleteException` for every entity, so `remove()` rolls the transaction back.
    Archiving is setting `archivedAt`; the history shows it as `ARCHIVE` and clearing it as `RESTORE`.
  - Startup fails if an `@Audited` entity is not tenant-scoped, has no UUID id, or audits a field
    without a faithful text form (embeddables, arrays, maps, JSON): such fields must be marked
    `@NotAudited` or `@AuditRedacted`. `@Audited` is inherited by entity subclasses.
- **Consequences:**
  - **Bulk JPQL and native `UPDATE`/`DELETE` statements are not audited and not blocked**, because
    they bypass the entity lifecycle. Use them only for `@NotAudited` technical state (today:
    `totp_last_step`, recovery code consumption) and review any new one.
  - Collections (`@OneToMany`, `@ElementCollection`) are not recorded on the owning side; audit the
    child entity instead.
  - Recovery codes and tenants are not audited yet. Tenants are global, and archiving a firm needs a
    platform-administrator role that does not exist.
  - A database owner can still drop the triggers. Real tamper evidence (hash chaining, shipping the
    log elsewhere) and an access log (logins, reads of sensitive records, client IP) are future work.
  - Fields are audited by default, so every new free-text field of an audited entity is copied into
    an append-only log. Whoever adds a sensitive field must decide whether it is `@AuditRedacted`.
    This conflicts with a suppression request under Ley 25.326 (art. 16): such a request will need
    a documented, privileged redaction procedure that bypasses the triggers [validar with a lawyer].
  - `DeletionGuard` also blocks orphan removal and cascaded removes; model those relations as
    archiving too.
  - `AuditTrail` returns whole lists; add paging before exposing it over HTTP.
  - One extra `INSERT` per audited change, in the same transaction.

## ADR-0011: Demo data seeded by an `ApplicationRunner` in the `demo` profile (T08)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** Development, screenshots and demos need a firm with users, without real data. The
  options were a Flyway repeatable migration with SQL inserts and a seeder run by the application.
- **Decision:**
  - **`DemoDataSeeder`, an `ApplicationRunner` active only with the `demo` profile**, not a Flyway
    seed. Passwords must be hashed by the application's `PasswordEncoder` (a migration would need a
    precomputed hash committed to the repository), and going through `TenantService` and
    `UserService` exercises the same rules as real data, including the audit listener, which
    records the creation with a `NULL` actor (ADR-0010). Seed data in a migration would also run
    in production.
  - **Resumable:** the seeder creates only what is missing (the firm `estudio-demo`, then each user
    by email), so restarting never duplicates users and completes a run that failed halfway. If the
    demo firm was archived, it logs a warning and seeds nothing: slugs are never reused and nothing
    is restored automatically.
  - **The password comes from `DEMO_PASSWORD` with no default** (`app.demo.password`). Startup fails
    if it is missing (unresolved placeholder), blank or shorter than 12 characters (validated
    before anything is written). It is never logged and is masked in `toString`.
  - **Clearly fictitious data:** the firm is "Estudio Demo (ficticio)" and the three users (owner,
    lawyer, paralegal) have invented names with emails in the reserved `example.com` domain.
- **Consequences:**
  - Never activate `demo` in production: it creates accounts with a shared, known password.
  - Run it with `DEMO_PASSWORD=... ./mvnw spring-boot:run -Dspring-boot.run.profiles=dev,demo`.
  - Later tasks that add demo cases and hearings extend the same seeder inside the firm's tenant scope.

## ADR-0012: README in Rioplatense Spanish (T09)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** CLAUDE.md asks for code, commits and PRs in English and UI text in Spanish, but says
  nothing about the README. Its audience is the people who would use the product (criminal-defense
  firms in Neuquén) and recruiters reading the portfolio, and the existing README was in Spanish.
- **Options:** an English README (wider reach, but it would not speak to the actual users), a
  bilingual one (twice the text to keep in sync), or Spanish.
- **Decision:** The README stays in Rioplatense Spanish, like the UI. Technical identifiers, ADRs,
  `CHANGELOG.md` and the rest of `docs/` stay in English. Headline decisions in the README link to
  their ADR instead of repeating it.
- **Consequences:** An English-only reader still gets the stack table, the Mermaid diagram and the
  commands, and can follow the links into the English ADRs.

## ADR-0013: Jurisdiction packages as versioned YAML, firm changes as overlay rows (T10)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** A jurisdiction must be configuration, not code: Neuquén ships by default and other
  provinces are added without code. Each firm must be able to rename, hide or add catalog items while
  the legal source (CPP article) and the review flags (`[validar]`, `[no verificado]`) of
  `docs/domain/neuquen-review.md` §2 stay visible. Options: seed the catalogs into per-tenant tables
  (a copy per firm, which drifts when the package is corrected), keep them in global tables (breaks
  the "`tenant_id` on every table" rule of ADR-0007), or keep them as read-only files and store only
  each firm's differences.
- **Decision:**
  - **One folder per jurisdiction** under `backend/src/main/resources/jurisdictions/<code>/`: a
    `jurisdiction.yml` manifest (code, name, `version`, law, review date, source) and one file per
    catalog. The catalogs are a fixed set (`Catalog` enum: stages, closing outcomes, hearing types,
    hearing statuses, cancellation reasons, coercive measures, procedural risks, liberty situations,
    alternative outcomes, circumscriptions), because later features attach behavior to them. Each
    item has a stable `code`, a `name`, an `article` (CPP article unless another law is named), its
    review `flags`, an optional `note` and free `attributes` for catalog-specific data (a hearing
    type's group and 2014 count, a circumscription's Colegio de Jueces and seat). File order is
    display order; hearing types are ordered by 2014 frequency.
  - **Validated at startup, all problems at once.** SnakeYAML (already shipped with Spring Boot)
    parses with its safe constructor and rejects duplicate keys; Jackson maps onto records with
    unknown keys rejected. Codes are unique and kebab-case, names and articles have length limits,
    every catalog file must exist, and the default package `neuquen` must be present. Any problem
    stops the application instead of showing a wrong catalog to a lawyer. `jackson-dataformat-yaml`
    was rejected because Spring MVC would then also accept and produce YAML on every endpoint.
  - **Firm changes are an overlay**: table `catalog_item_customization` (tenant-scoped, `@Audited`)
    with one row per changed item. A row on a built-in item stores only a new name and/or the hidden
    flag; the article cannot be overridden (database check). A firm item has a generated
    `custom-<12 hex>` code (a prefix packages may not use), a name and an optional article. Nothing is
    deleted: hiding replaces removal and clearing the name restores the package's. Responses carry
    both `name` and `sourceName`, the `article`, the `flags` and the `origin` (`JURISDICTION`/`FIRM`).
  - **Catalog policy.** Every catalog allows renames. Hiding and adding depend on the catalog:
    stages, hearing statuses and liberty situations drive behavior (summary of the most delayed stage,
    the OFIJU status flow, the computed liberty situation), so they are rename-only; coercive
    measures, procedural risks and alternative outcomes mirror closed legal lists, so they can be
    hidden but not extended; the rest allow all three. A violation answers `409`.
  - **Only the owner (titular) changes catalogs**, since a change applies to the whole firm; every
    member reads them, hidden items included (`includeHidden=true`), so existing records that use a
    hidden item still resolve. The article of a firm item is set when it is added; it can be renamed
    or hidden afterwards, like any item. Two simultaneous first changes of the same item answer
    `409` for the loser (unique key) instead of a `500`.
  - **Item codes are stable**: a new package version may add items and correct names, articles or
    flags, but never renames or removes a code. Overlay rows are keyed by code, so corrections reach
    every firm automatically and a firm's rename survives them.
- **Consequences:**
  - The data of `neuquen-review.md` §2 is now in two places; the YAML is what the application uses,
    and changes to the domain doc must be carried to it (bump `version`).
  - A firm cannot switch jurisdiction; overlay rows are not tagged with the package code yet. That is
    enough while every firm uses Neuquén.
  - Item references in later tasks (T12, T13) store the code as text, validated against the firm's
    catalog by the service, not by a foreign key.
  - The articles of arts. 156 to 272 come from secondary sources; only the items the domain review
    tagged carry `[no verificado]`, exactly as in the review.

## ADR-0014: Persons, clients and the conflict check (T11)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** A firm needs the people around its cases (defendants, victims, witnesses, experts...)
  and, among them, its own clients with the consent to process their data. Cases do not exist yet
  (T12), and the data is sensitive: Ley 25.326 treats data about health, ethnic origin or criminal
  proceedings with special care (art. 2 defines sensitive data, art. 7 restricts collecting it).
- **Decision:**
  - **Roles are a catalog, links come with cases.** T11 adds the `party-roles` catalog to the
    jurisdiction package (ADR-0013): imputado, víctima, querellante particular, querellante
    institucional, testigo, perito, fiscal, defensor, juez, familiar de contacto and garante. It is
    **rename-only** because behavior will hang on the codes. Each item has a `side` (`defence`,
    `accusation`, `neutral`) and the victim has `notificationRights=true` (art. 61); only arts. 61 and
    65 are cited, as in the domain review, and the institutional plaintiff is flagged `[validar]`.
    The table that links a person to a case with a role is T12's.
  - **Persons** (`person`, tenant-scoped, `@Audited`, archived never deleted): `HUMAN` (first and last
    names) or `LEGAL` (legal name), optional aliases, document type (`DNI`, `PASSPORT`, `CUIT`,
    `CUIL`, `OTHER`) and number, birth date, nationality, phone, email and address. Database checks
    enforce the shape of each kind and that document type and number go together. The kind cannot
    change.
  - **One record per document.** A unique index on `(tenant, type, number)` keeps a person once; a
    duplicate answers `409 person-duplicate-document` with `existingPersonId`, so the user opens the
    existing record instead. Numbers are stored **normalized** (uppercase, no spaces, dots or
    hyphens) and checked against the type's shape (a DNI has 7 or 8 digits, a CUIT or CUIL 11).
  - **Conflict check by document** (`POST /persons/conflict-check` with the number in the body, so a
    DNI never lands in a URL, an access log or the browser history; also embedded in a client's
    detail). Matching is on the normalized number, and a DNI also matches a stored CUIT or CUIL whose
    digits 3 to 10 hold the DNI (CUIL `20-30123456-7` is DNI `30123456`), in both directions. A
    passport or other document with 11 digits never matches a DNI that way.
    Archived people are included and flagged. It is a simple alert with a disclaimer (the system
    assists, the lawyer controls); it grows to case roles in T12, where it will tell who the person
    is on which case (for example, a prospective client who is the victim in another case).
  - **Clients** (`client`): the firm's relationship with one person (unique per person, archived
    counts), with intake date, how the client arrived, and the consent to data processing: date,
    scope and a reference to the signed form (file storage comes later). Date and scope go together.
  - **Authorized contacts** (`authorized_contact`) are plain rows of the client (name, relationship,
    phone, email and **what the firm may tell them**), not persons: that avoids person-to-person
    relations and their privacy questions. They are archived, never deleted.
  - **Deliberately left out:** health, addictions, socioeconomic or ethnic data, relations between
    persons and a free-text "notes" field on persons (it invites sensitive data). The "indigenous
    people" field belongs to the defendant in the case, so it is T12's; ethnic origin is sensitive
    data under art. 2 `[validar]`.
  - **Authorization:** every member of the firm reads, creates and edits persons, clients and
    contacts (no restriction for the administrative role yet); only the owner and lawyers archive and
    restore persons and clients (`403` otherwise), since archiving hides a file from everyone. There
    is no `DELETE` endpoint. Every foreign key is loaded through a tenant-filtered repository, so an
    id of another firm answers `404`.
- **Consequences:**
  - A person who is a defendant in one case and a victim in another is one record (T12 gives the
    roles); a document cannot be corrected into one that exists, the existing record must be used.
  - Matching DNI and CUIT/CUIL is by digits only, without validating the check digit; accent-insensitive
    search is left for later (a plain case-insensitive match is used).
  - Package `neuquen` is now version 2 (new catalog).
  - **Contact data is audited in full.** Names, document, birth date, phone, email and address are
    personal but not sensitive data (art. 2), and a lawyer must be able to see who changed a
    procedural address and what it was before, so they are not `@AuditRedacted`. The log is a second
    copy that archiving does not touch: a suppression request (art. 16) follows the privileged
    redaction procedure foreseen in ADR-0010 `[validar]`. A future sensitive field must be redacted.
  - Archived persons can still become clients and archived clients can still be edited: archiving
    hides a file from lists, it does not freeze it. Restore it first if the UI wants that to show.
  - Only a race on the unique keys (`person_document_uk`, `client_person_uk`) answers `409
    concurrent-change`; any other integrity violation is a bug and answers `500`.
  - Intake and consent dates cannot be in the future.

## ADR-0015: Case file, defendants, parties and team (T12)

- **Date:** 2026-11-21
- **Status:** accepted
- **Context:** The case (legajo) is the backbone for hearings (T13) and deadlines (T14). In the CPP de
  Neuquén each defendant goes through the process on their own: charges are formulated per person
  (art. 133), rebellion suspends the proceedings only for the rebel (art. 52), and alternative
  outcomes and closings (arts. 107, 108) end the case for one defendant while it goes on for the
  others. A single "stage" or "status" on the case would therefore be wrong as soon as there are two
  defendants.
- **Decision:**
  - **New feature package `casefile`** (entity `CaseFile`, since `case` is a Java keyword), migration
    `V8__case_file.sql` with five tenant-scoped, `@Audited` tables archived instead of deleted:
    `case_file`, `case_team_member`, `case_party`, `defendant` and `defendant_charge`. There is no
    `DELETE` endpoint.
  - **The case holds identification only:** caption (carátula), the firm's internal number, the MPF
    legajo, the OFIJU and Pehuén numbers, circumscription (catalog), action type, who the firm
    represents (defence or private prosecution / querella) and the reserved flag.
  - **MPF legajo** is `MPF` + seat letters + number/year (`MPFNQ 123989/2018`). Input is normalized
    (uppercase, trimmed, exactly one space between seat and number) and checked against
    `^MPF[A-Z]{2,4} \d{1,7}/\d{4}$`, also as a database check. It is unique per firm; a duplicate
    answers `409 case-duplicate-legajo` with `existingCaseId`, like the duplicate document of ADR-0014.
    The list of seats is not validated `[validar]`. **OFIJU and Pehuén numbers are free text**: their
    format is not confirmed `[validar]`.
  - **Action type** is an enum that carries its article: public (art. 99), public on private
    complaint (dependiente de instancia privada, art. 100) and private (art. 101).
  - **State lives on each defendant:** stage (catalog `stages`, default `averiguacion-preliminar`),
    status (`ACTIVE`, `SUSPENDED` e.g. on probation, `IN_MEDIATION`, `CLOSED`), closing outcome
    (catalog `closing-outcomes`), charges-formulation date (art. 133), defence counsel (the firm, or a
    private or public defender by name) and rebellion declared/lifted dates (art. 52). Database checks
    tie `CLOSED` to stage `cerrada` and to an outcome; the service answers a clear `400` first. Dates
    cannot be in the future and a lifted rebellion needs a declared one that is not later. A second
    rebellion overwrites the dates: the audit log keeps the history, and T14 may move them to a
    periods table if the deadline engine needs every period.
  - **Computed summary on the case**, never stored: active defendants, open defendants and the most
    delayed stage (the earliest stage, in catalog order, among open defendants; `cerrada` when all are
    closed; none without defendants). Detainees and the next hearing need coercive measures and
    hearings, so **T13 adds them** to the summary.
  - **Charges kept simple:** each defendant has rows with an offence text and an optional legal
    reference (`CP art. 166 inc. 2`). An offence catalog is left for later.
  - **Parties vs defendants.** A defendant is its own table because it carries the procedural state; a
    party (`case_party`) links a person to a case with a `party-roles` code (victim, plaintiff,
    witness...). The role `imputado` is rejected as a party (`400`, use the defendants endpoint).
    The same person cannot be an active defendant twice in a case, nor hold the same party role twice
    (`409`).
  - **Catalog codes** (circumscription, stage, outcome, party role) are stored as text and checked
    against the firm's catalog (ADR-0013): a new or changed value must be visible; an unchanged value
    is kept even if the firm hid that item later, so hiding an item never breaks old cases.
  - **Team:** `RESPONSIBLE` (exactly one, owner or lawyer), `COLLABORATOR` and `PARALEGAL`. The creator
    names the responsible (defaults to themselves). The team is replaced as a whole; removed rows and
    changed roles are archived and new rows added, so the history stays in the table and the audit
    log. Only the owner or the case's responsible change the team or the reserved flag (`403`). A
    case update that omits `reserved` keeps the current value, so a client that does not send it
    never un-reserves a case and a collaborator can still edit the case data.
  - **Updates are full replaces with no silent resets.** The defaults (stage, status, defended by the
    firm) only apply when a defendant is added; updating one needs its stage, status and
    `defendedByFirm` (`400` otherwise), so an empty body cannot reopen a closed defendant.
  - **Archived means read-only.** An archived case or defendant cannot be edited, nor get new
    defendants, parties or charges (`409 archived-record`) until it is restored; archiving children
    stays allowed. An archived person cannot be added to a case (`400`): restore the person first.
  - **Reserved cases** are visible only to their active team and the owner. For anyone else they do
    not exist: `404` on every endpoint under the case and absent from the list, filtered in the query
    so the `total` is right. A non-owner who creates a reserved case is added to its team, so they do
    not lose it right away.
  - **Authorization otherwise:** every member reads non-reserved cases and edits case data,
    defendants, charges and parties of the cases they see; only the owner and lawyers archive and
    restore the case (same rule as persons). The rules live in `CasePermissions` with unit tests.
  - **Conflict check grows to case roles** (follows ADR-0014): each match now lists the person's
    active roles in cases, defendants as `imputado`. For a reserved case the user cannot see, the
    case id and caption are hidden and `reserved: true` is set, so the alert still fires without
    revealing the case. The role (e.g. `imputado`) stays visible on purpose: that is the information
    the conflict alert exists for. To keep packages acyclic, `person` declares the `PersonCaseRoles` interface
    and `casefile` implements it; `casefile` uses the public `Persons` facade.
  - **Indigenous people** (pertenencia a pueblo indígena, art. 109 and ILO Convention 169) is an
    optional yes/no on human defendants only, `[validar]`. Ethnic origin is sensitive data (Ley 25.326
    art. 2), so the field is `@AuditRedacted`: the log records that it changed, not the value.
  - **No criminal-record field** (antecedentes): Ley 25.326 art. 7 restricts that data to the
    competent authorities.
- **Consequences:**
  - Every foreign key is loaded through a tenant-filtered repository or facade: a person or user of
    another firm answers `404`, and a child id from another case too.
  - Accepted trade-off: case numbers are unique per firm, so a user who types the legajo or internal
    number of a reserved case they cannot see gets the `409`, without `existingCaseId`. It reveals only
    that the number is taken, which the user already knows, and avoids two cases with one legajo.
  - Deferred to later tasks: fact narrative, key dates, connected cases, juvenile court, an offence
    catalog, detainees and next hearing in the summary (T13), and deadlines per defendant (T14).
  - The demo firm gets fictitious persons and two cases (one reserved, one with two defendants in
    different stages).

## ADR-0016: Hearings, coercive measures and the agenda (T13)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** The hearing agenda is the core of the product: a lawyer opens it to know what is on
  today and this week, whether two hearings collide, and which clients are detained. In the accusatory
  procedure the hearing is the unit of work (the 2014 statistics in `docs/domain/neuquen-review.md`
  §2.2 are counted per hearing type), and coercive measures (arts. 113 to 120) are decided in hearings
  and carry the only deadlines that a lawyer cannot afford to miss: a detainee's.
- **Decision:**
  - **New feature package `hearing`** (hearings, measures, agenda, alerts), migration
    `V9__hearing_and_coercive_measure.sql` with six tenant-scoped, `@Audited` tables archived
    instead of deleted: `hearing`, `hearing_defendant`, `hearing_lawyer`, `hearing_reschedule`,
    `coercive_measure` and `coercive_measure_risk`. There is no `DELETE` endpoint. Who changed what and
    when lives in the audit log (ADR-0010), not in `created_by`/`updated_*` columns;
    `hearing_reschedule` is append-only, so it has no `archived_at`. Catalog codes (type,
    status, cancellation reason, measure, risk) are text validated against the firm's catalog exactly as
    in ADR-0015: a new or changed value must be offered, an unchanged one is kept even if hidden.
  - **Packages stay acyclic with two small seams.** `hearing` reaches cases through the public facade
    `casefile.Cases` (visibility, responsible, defendants, archive permission), like `Persons` for
    people; `casefile` gets the detainee count and next hearing of its summary through
    `CaseHearingSummaries`, declared in `casefile` and implemented in `hearing`, like `PersonCaseRoles`.
    The queries that must filter inside the database (agenda, alerts, detainee count) read `CaseFile`,
    `CaseTeamMember` and `Defendant` by entity name in JPQL: the Hibernate tenant filter still applies
    to every entity of the query, and reserved and archived cases are excluded in the query, never
    after it.
  - **Hearing.** Type, start (`timestamptz`), duration (5 to 1440 minutes, default 60), room, judge,
    OFIJU reference (free text `[validar]`), who requested it, status (default `programada`),
    cancellation reason, the type it was held as (only `reconvertida`), result summary, link to the
    next hearing and notes. Defendants must belong to the hearing's case (`400`; another firm's id is
    `404`). Lawyers are active members of the firm; if none is given the case's responsible attends. The
    defendant and lawyer lists are replaced as a whole on update (removed rows are archived, as in the
    case team); an omitted list, status or duration on update keeps the current value, and an empty
    lawyer list is a `400`.
  - **Status rules** live in a pure class (`HearingRules`) and are repeated as database checks: a
    cancellation reason only for `cancelada`/`suspendida`; the held-as type only, and always, for
    `reconvertida`; a result or next hearing only for `efectiva`, `reconvertida` and
    `cuarto-intermedio`. The status catalog is rename-only (ADR-0013), which is why its codes are safe
    to use in code and in checks. `reprogramada` is only reached by rescheduling, so a manual edit
    cannot skip the history, and the date of an existing hearing only changes through the reschedule
    endpoint (`400` otherwise).
  - **Reschedule** appends a row to `hearing_reschedule` (previous and new start, reason, user) and
    sets the status to `reprogramada`; history is shown newest first and is never edited. A cancelled
    hearing cannot be rescheduled or get a result (`409`); a suspended one can, and so is a hearing that
    already has a result (`efectiva`, `reconvertida`, `cuarto-intermedio`) refused with `409`.
    Rescheduling to the same instant is a `400`. Editing a `cancelada` hearing back to `programada` is
    allowed on purpose, to undo a mistaken cancellation.
  - **Result** (`POST /hearings/{id}/result`) records `efectiva`, `reconvertida` or
    `cuarto-intermedio`; a `nextHearing` creates a scheduled hearing in the same case and links it.
    Cuarto intermedio does not require one. A hearing that already has a next hearing answers `409` to
    a second one. The follow-up copies only the defendants that are not archived and the lawyers that
    are still active (the case's responsible when none is). The response carries the clashes of the
    hearing that got the result, not those of the follow-up (read the follow-up to see its own).
    On edit, a defendant or lawyer already attached is kept even if archived since; only new ones are
    checked.
  - **Clashes are warnings, per lawyer.** Two hearings clash for a lawyer when both list them and
    `[start, start + duration)` overlap (a hearing starting when another ends does not). Archived
    hearings, hearings of archived cases and `cancelada`/`suspendida` hearings never clash. Create,
    update, reschedule, result and detail answers carry `clashes`; for a reserved case the user cannot
    see, `caseId` and `caseCaption` are hidden and `reserved: true` is set (same masking as the
    conflict check, ADR-0015). The overlap decision is a pure class (`ClashDetector`); the database
    only preselects hearings that start within 24 hours before (the maximum duration).
  - **Agenda** (`GET /agenda?from&to&lawyerId`): local days, `to` inclusive, at most 31 days, `from`
    defaults to today and `to` to `from`. The zone is the constant `America/Argentina/Salta`, which is
    Neuquén's zone in the tz database (UTC-3, no daylight saving); a hearing at 23:30 local belongs to
    that day. A property per firm is left for when another province is added. "Today" comes from the
    injectable `Clock`. Items carry the catalog names and article, defendants, lawyers, `detainee` (a
    listed defendant has an active `prision-preventiva` or `detencion-domiciliaria`) and `hasClash`.
  - **Coercive measure** per defendant: catalog code, `conditions` (free text for the measure's own
    data: who, how often, where, amount), detention place (only preventive prison and house arrest),
    procedural risks (only preventive prison), start, fixed end (art. 116), next review, the ordering
    hearing (of the same case) and the lifting day (cese). Risks are a child table (`@Audited`,
    replaced as a whole) instead of an array column, because the audit log needs scalar fields. A
    preventive prison is rejected in a case of private action (art. 115). Start dates may be in the
    future (measures can be ordered ahead); the end, the review and the lifting day cannot precede the
    start, and a lifting day cannot be in the future. Active means neither archived nor lifted; for the
    detainee flag, the case's `detaineeCount` and the alerts it must also have started (start on or
    before today in the firm's zone), so a measure ordered ahead is not yet a detainee. Restoring a
    measure needs its case and defendant not archived (`409`), like restoring a hearing.
  - **Detainee alerts are assisted, not the T14 engine.** For active custodial measures of visible,
    not archived cases and defendants: `ENDS` (art. 116), `REVIEW` (art. 118), `MAX_DURATION` (one year
    since the start of a preventive prison, art. 119, "salvo asuntos complejos") and `NO_DURATION` (a
    preventive prison without a fixed end, art. 116). Calendar days (corridos), overdue first, each with
    the text "Cálculo asistido: verificá con la norma." A pure class (`DetaineeAlerts`) computes them
    from the dates loaded by the lawyer; the one-year count is `[validar]` (the Instrucción General
    7/2015 dispute about when it runs).
  - **Case summary** gains `detaineeCount` (active defendants with an active custodial measure) and
    `nextHearing` (the earliest upcoming hearing that is not archived and not `cancelada`, `suspendida`,
    `efectiva` or `reconvertida`).
  - **Authorization:** whoever sees the case creates and edits its hearings and the measures of its
    defendants; only the owner and lawyers archive or restore (`403` otherwise), reusing the rule of
    cases. An archived case, defendant, hearing or measure answers `409 archived-record` on edits;
    anything of a reserved case the user cannot see answers `404`, and so does another firm's record.
- **Consequences:**
  - The demo firm gets fictitious hearings this week and next (two of one lawyer overlap, one in the
    reserved case), a preventive prison with end and review dates, and a periodic appearance.
  - A measure's lifting day and a hearing's result are not tied: lifting a measure does not need a
    hearing, and ordering one does not require it either. Linking them is up to the lawyer.
  - Deferred: clashes that need travel time between cities, the hearing preparation checklist, the
    audiovisual link, client notification, and the coercive-measure deadlines in the T14 deadline engine.
  - Changing a status away from a result status through the edit endpoint drops the link to the next
    hearing, which is kept on its own row.

## ADR-0017: Deadline rule engine (T14)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** Deadlines are the product's differential against Lex-Doctor, and the riskiest part: a
  wrong date has legal consequences. The stage 0 review (`docs/domain/neuquen-review.md` §3) lists 13
  rules for the MVP, each with an article, a trigger, an art. 79 computation type, a consequence that
  courts have sometimes declared unconstitutional ("Estarli", "Olave"), chained extensions and
  suspending events. It also argues against a user-editable rule engine for the MVP.
- **Decision:**
  - **Rules are configuration of the jurisdiction package, not data.** `deadline-rules.yml` and
    `court-calendar.yml` live next to the catalogs in `resources/jurisdictions/neuquen/` and are read
    by their own loader in the new `deadline` package (strict mapping, every problem reported at once,
    any problem stops the startup), like ADR-0013. A rule carries code, name, article and law, trigger,
    kind (legal or judicial), computation, duration, scope (defendant or case), `detainee`,
    consequence, case-law status (text, link, review date), extension steps (who grants each and its
    maximum), suspending events, default warning, review flags and a note. The loader enforces the
    invariants: a judicial rule and only a judicial rule is `SET_BY_COURT` and has no duration; a term
    in hours cannot be suspended; a rule citing arts. 156 to 272 must carry `no-verificado` (the public
    copies of Ley 2784 stop at art. 155).
  - **14 rules:** the 13 marked "Sí" plus `plazo-judicial`, a generic judicial deadline for any term a
    judge or prosecutor sets, since the roadmap asks for judicial deadlines entered by hand. The
    ordinary appeal's doubling in complex cases (art. 224) is modelled as its one extension step. The
    mediation (Ley 2996) is both a rule (60 days + 30) and a suspension kind.
  - **Firms change only two things:** `deadline_rule_setting` stores `enabled` and `alert_days_before`
    per rule (owner only, audited). A disabled rule accepts no new deadline (`409`) and its deadlines
    leave the firm-wide list but stay on the case, flagged.
  - **Computation (`DeadlineCalculator`, pure and unit-tested per type):** hours run continuously from
    an instant; day terms count from the day after the trigger, business days skip weekends and the
    court calendar, calendar days (corridos) do not; months and years go date to date (a missing day is
    the month's last, Código Civil y Comercial art. 6); a judicial deadline starts from the date the
    lawyer loaded. Day-based terms end at 24 h of the last day (`dueAt` = start of the next local day,
    zone `America/Argentina/Salta` as in ADR-0016). Suspended days never count: day terms skip them,
    month, year and judicial terms move forward by the suspended calendar days inside the term, until
    the end stops moving. An open suspension that starts before the end leaves the deadline
    `SUSPENDED` without a date. A last day that falls on a holiday is not moved forward `[validar]`.
  - **Court calendar:** national holidays (Ley 27.399, movable ones already moved), bridge days and
    the January and winter judicial recesses for 2025–2027, all tagged `[validar]` where they depend on
    a yearly decree or TSJ resolution. A business-day term that reaches a year not loaded is
    `NOT_CALCULABLE` with the missing year: the engine never guesses. A test fails when the current year
    is missing, so a new year cannot start unnoticed. Provincial and local non-business days (asuetos,
    a city's founding day) are not listed yet `[validar]`: a business-day deadline can come out one day
    early, the unsafe direction, and the file says so.
  - **Case law is cited by the ruling's name** ("Estarli", "Olave"), as courts and the press do, and
    linked to press notes, never to a court file whose name carries a case number (CLAUDE.md, rule 1).
  - **Concrete deadline (`deadline`):** case, optional defendant (required by scope), rule code, the
    trigger day (and instant for hours), the date the court set (judicial only), the hearing where it
    started, the day it was met and notes. **The due date is computed on read**, never stored: a
    corrected rebellion, suspension or extension changes it at once, and a fixed rule in a new package
    version applies to every deadline. A small firm has hundreds of deadlines; the firm-wide list loads
    them with a handful of queries and computes in memory.
  - **Extensions (`deadline_extension`)** are append-only rows (amount in the rule's unit, day granted,
    granting hearing); their step is their position by day granted. The count and each step's maximum
    come from the rule (`409` past the count, `400` over the maximum). A step cannot be granted before
    the previous one, the deadline's start cannot move after a granted extension, and only the last
    extension can be archived (`409` otherwise), so no extension ever moves to a step it was not checked
    against.
  - **Supported dates:** every date a deadline or suspension takes is between 1990-01-01 and
    2100-12-31 (`400` otherwise), and suspended days are added by interval arithmetic, so a typo cannot
    make a read loop for millions of days or overflow `LocalDate`.
  - **Suspensions:** rebellion is read from the defendant's own dates (art. 52) and applies only to
    that defendant's deadlines. Mediation and the federal extraordinary appeal are loaded on the case
    (`deadline_suspension`), for every defendant or one; open while they have no end. Each applies
    only to the rules that list its kind. Which rules list mediation is `[validar]`.
  - **Status** at read time: `MET`, `SUSPENDED`, `NOT_CALCULABLE`, `OVERDUE`, `DUE_SOON` (within the
    firm's warning, and always in the last 24 hours) or `RUNNING`. Lists put met deadlines last,
    detainee deadlines first, then the soonest end. `GET /api/v1/deadlines?withinDays` (1–365, default
    30) shows overdue, due-soon, not-calculable and running deadlines ending within the window, of
    visible, not archived cases and defendants (filtered inside the query, as in ADR-0016).
  - **Every due date travels with its source** (article and law), consequence, case-law status, flags
    and the text "Cálculo asistido: verificá con la norma."
  - **Access:** whoever sees the case loads and edits its deadlines and suspensions; only the owner and
    lawyers archive or restore them or archive an extension; reserved and other firms' records are
    `404`. `hearing` gains a public `Hearings.caseOf` and `DefendantRef` gains the rebellion dates.
- **Consequences:**
  - The detainee alerts of ADR-0016 stay as they are (they read the measure's own dates); the
    preventive-prison rules here are loaded as deadlines. Creating deadlines automatically from
    measures, hearings or the charges date is deferred: the lawyer loads the trigger.
  - Deferred: firm-specific non-business days (asuetos), a court calendar per circumscription, the
    six rules marked "Después", deadlines that only count during business hours, and notifications.
  - Adding 2028 means adding its days to `court-calendar.yml` before the year starts.
  - The demo firm gets a preventive prison's fixed and maximum duration, an investigation about to
    expire and an ordinary appeal.

## ADR-0018: Custom fields as per-firm definitions and JSONB values (T15)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** Everything that is not core must be configurable per firm without code (CLAUDE.md). The
  first piece is custom fields on cases and defendants: a firm adds, for example, "Honorarios
  pactados" to its cases or "Unidad de detención" to its defendants. `docs/domain/data-model.md` §16
  sketches a much larger design (twelve types, sections, roles, versioned definitions, indexed search);
  the MVP needs the part every firm uses.
- **Decision:**
  - **Values live in a `jsonb` column `custom_fields` on the record itself** (`case_file`,
    `defendant`), keyed by the definition's key, not in an EAV table. One read returns a record with
    all its values and the code stays small. The trade-off is that the database knows neither the
    types nor the keys (it only checks the column is a JSON object), so `CustomFieldValues` validates
    in the service: every key must be an active definition of that record, and each value must fit its
    type. Searching or filtering by a custom field is deferred (a GIN index or a generated column can
    be added when a use case needs it).
  - **Definitions (`custom_field_definition`)** have a record (`CASE_FILE` or `DEFENDANT`), key, label,
    type (`TEXT`, `NUMBER`, `DATE`, `BOOLEAN`, `LIST`), options, required flag and position. At most
    50 active definitions per record and firm, and 100 options per list. The 50 limit is a
    best-effort cap (count, then insert, no lock): two simultaneous creates can end at 51, which is
    harmless.
  - **The key is generated from the label** (lowercase, accents stripped, hyphens, `-2`, `-3`... on a
    collision) **and never changes**, like the record, the key and the type: stored values point at
    the key, so a rename never orphans data. Keys are unique per firm and record **including archived
    definitions**, so a key is never reused for something else.
  - **Options of a list are `{code, label, hidden}`**, with the code generated like the key and
    immutable. They are added, renamed and hidden, never removed: a hidden option is not offered for
    new values but the records that hold it keep it and can save it unchanged. A list needs at least
    one visible option.
  - **Archiving a definition keeps its values**: they are not shown, not validated and not touched by
    later edits (a request cannot name an archived key, but the stored value is carried over), so
    restoring the definition brings the data back. Nothing is deleted.
  - **Value rules:** text is trimmed, at most 1000 characters, and blank means no value; a number is a
    JSON number stored as a plain decimal (`5.50` and `5.5` are the same) with at most 15 significant
    digits, because Hibernate reads `jsonb` numbers back as doubles and 15 digits survive that exactly;
    a date is an ISO day; a
    boolean is `true` or `false`; a list is the code of an option. A `null` or missing value clears
    the field, and a required active field without a value is `400`.
  - **Replace and keep semantics:** `customFields` sent on a case or defendant replaces the values of
    the active fields (the rest of the record is a full replace too); **omitted, the stored values stay
    untouched and are not validated**, so a field made required later never breaks an unrelated edit.
    A new record with no values has an empty map, so required fields apply.
  - **Access:** every member reads the definitions (they all fill them in), only the owner creates,
    changes, archives or restores them, like catalogs (ADR-0013); another firm's id is `404`.
  - **Audit (ADR-0010):** `AuditRecorder` now audits a map or list property as its JSON text (map
    keys sorted and numbers in one canonical decimal form, so equal maps give equal text) and records
    no change when the old and new text are equal. Values of custom fields therefore appear in the
    change history in clear. This applies to every JSON property of an `@Audited` entity: whoever adds
    one that may hold sensitive data must mark it `@AuditRedacted`.
  - The public `customfield.CustomFields` is the only thing `casefile` uses: `resolve` and
    `resolveNew` validate what a request brings, `visibility` filters the values shown to those of
    active fields. `InvalidCustomFieldValueException` is answered `400` by the case and defendant
    controllers.
- **Consequences:**
  - A firm must not create fields for sensitive data (Ley 25.326, arts. 2 and 7: criminal records,
    health, ethnic origin...): the audit log stores the values, unlike the redacted
    `indigenousPeople` flag. The configuration screen (T25) must warn the owner.
  - Deferred: case templates per case type that preselect fields, custom fields on other records
    (persons, hearings, deadlines), the other types of §16 (long text, currency, multiple list,
    person), help text, sections, per-role visibility and search by custom field.

## ADR-0019: CSV/Excel import through the regular services, all or nothing (T16)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** A firm that adopts the product already has its cases in a spreadsheet or in another
  system's export. Typing them one by one is the main barrier to start. The import must give a
  preview with a validation report, never leave half a file loaded, and apply exactly the rules of
  the regular endpoints (tenant, catalogs, duplicates, audit), not a second copy of them.
- **Decision:**
  - **Three kinds, one row per record:** `persons`, `cases` (one row per case and defendant: rows
    that share the MPF legajo or internal number are one case with several defendants; the case
    columns of a later row must be blank or equal to the first one) and `hearings` (each row names
    its case by legajo or internal number). Persons first, then cases, then hearings. A defendant is
    found by document; if no person has it and the row gives names, a human person is created. The
    file headers are Spanish, accent-free and case-insensitive (`legajo_mpf`, `numero_documento`...);
    an unknown, duplicated or missing required header rejects the file (`400 import-invalid-file`), so
    a typo never drops a column silently. `GET /api/v1/imports/{kind}/template` downloads a CSV with
    the headers and one fictitious example row.
  - **Formats:** CSV in UTF-8 (BOM tolerated, `;` or `,` detected from the header line, since Excel in
    Spanish saves with `;`) read with Apache Commons CSV, and `.xlsx` (first sheet) read with Apache
    POI, whose zip-bomb and entity-expansion guards stay at their defaults. Dates `dd/mm/aaaa` or ISO,
    or a date cell; times `hh:mm` in the firm's zone (`America/Argentina/Salta`, ADR-0016). Catalog
    columns take the code or the visible name, case- and accent-insensitive. Limits: 2 MB and 1000
    data rows (`400`), so a bad file cannot hold a transaction for long. Legacy `.xls` is not read.
  - **Stateless preview and commit with the same code path.** `POST /api/v1/imports/{kind}` with the
    file (multipart) and `dryRun` (default `true`). The rows run, in order and in one transaction,
    through the regular services of each feature; a row error is recorded and the next row runs. A dry
    run always rolls back; a commit rolls back if any row failed (`422 import-has-errors` with the
    report) and commits otherwise. Nothing of the file is stored: no upload table, no token, no copy
    of personal data waiting on the server; the client sends the file again to commit. Because the
    rows really run, the preview sees duplicates inside the file and references to rows above.
  - **The report** has total, valid and error rows, what would be (or was) created per record type,
    and each row with its number in the sheet (the header is row 1), a short label and its errors
    (`column`, Spanish `message`, optional technical `detail`). Values are not echoed back in errors,
    and the import logs no cell values.
  - **Packages stay acyclic with one seam.** `dataimport` owns the endpoint, parsing, limits, the
    transaction and the report, and declares `RowImporter`; `person`, `casefile` and `hearing` each
    implement it with their package-private services, translating their own exceptions into row
    errors. Bean Validation runs on the same request records as the API.
  - **Access:** only the owner and lawyers import (`403` otherwise): a bulk load creates many records
    at once. Imported records are audited like any other, under the importing user. Imported cases
    are not reserved, their responsible is the `abogado_responsable` email (a lawyer or owner of the
    firm) or the importing user; hearings default to the case's responsible as lawyer.
  - A race on a unique key while the import runs (another user saves the same document) aborts the
    whole import with the usual `409 concurrent-change`.
  - **Details settled while building it:** a document number without a type is a DNI for a human and
    a CUIT for a legal entity; a type without a number, or a defendant column without the defendant's
    document, is a row error. A required column means the header must exist: a continuation row of a
    case leaves the case columns blank. A hearing whose case is missing, belongs to another firm or is
    a reserved case the user cannot see gets the same "No existe un caso con ese número", and an
    archived case its own message; a legajo and an internal number that name different cases are an
    error. A case number already used by a reserved case the user cannot see is reported as taken,
    without anything else, like the `409` of ADR-0015. Records count in the report only when their
    row succeeds. The `.xlsx` sheet is read in streaming (SAX), so the row limit stops the reading
    early; a file with more than 100 columns is rejected.
- **Consequences:**
  - Deferred: charges, parties other than defendants, coercive measures and deadlines; custom-field
    columns; updating existing records (a row that matches one is an error, not an update); `.xls`
    and `.ods`; mapping arbitrary column names in the wizard (T26 can map them on the client and send
    the expected headers).
  - A file with 1000 rows is validated twice (preview and commit). That is accepted: it keeps the
    server free of stored uploads.

## ADR-0020: Visual direction (T19)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** The frontend still has the shadcn/ui neutral theme. Before building screens we
  need one visual direction that works for lawyers from 25 to 75, mostly on the phone between
  hearings, for a product that handles people's liberty: serious, calm, fast, AA contrast and
  large type. The hearing agenda is the core screen, so the direction is judged on it.
- **Decision:**
  - Three directions were mocked as static HTML pages of "Audiencias de hoy" with the same
    fictitious data (`docs/design/mockups/`), captured at 390×844 and 1440×900
    (`docs/design/screenshots/`): **A "Limay"** (deep river blue on cool paper, Atkinson
    Hyperlegible Next, a vertical day rail with a "now" line), **B "Toga"** (navy chrome and
    oxblood, IBM Plex Sans and Serif, a dense docket table) and **C "Estepa"** (olive on sage
    stone, Figtree, a large "next hearing" panel and big cards).
  - **A is chosen.** A typeface designed for low-vision readers with a 17 px body and a 15 px
    floor that has no exceptions (navigation labels included); every text pair above 6:1 in
    light and dark (measured with `node scripts/contrast.mjs`; muted text 7.39:1 on cards);
    on a phone it shows the count, the detainee alert and two hearings in the first screen,
    collapsing past ones; and its single cool accent reads serious without the traditional-firm
    look of B or the consumer-app look of C. B's table survives as the pattern for desktop list
    screens; C's "next hearing" panel is a possible later addition.
  - `docs/design/DESIGN.md` (`status: approved`) is the spec for T20: light and dark tokens in
    shadcn names (including `sidebar-*` and `chart-*`) plus product tokens (`detained`,
    `deadline`, four `status-*` pairs), dark mode wiring with a `.dark` class
    (`@custom-variant dark`), type scale, spacing, radius, elevation, lucide icon meanings,
    motion rules and tone of voice.
  - `scripts/contrast.mjs` (plain Node, no dependencies) measures every token pair of both
    themes with WCAG 2.x relative luminance and fails if one is below 4.5:1 (text) or 3:1 (UI).
    T20 adds a Vitest token-contrast test over `frontend/src/index.css` with the same pairs.
  - Red is reserved for a client deprived of liberty, amber for deadlines; color is never the
    only signal (word and icon always). Motion respects `prefers-reduced-motion`
    (`MotionConfig reducedMotion="user"` plus a CSS guard).
- **Consequences:**
  - T20 adds the Atkinson Hyperlegible Next font (self-hosted, Fontsource) and replaces the
    neutral shadcn theme in `frontend/src/index.css` with these tokens; the existing login and
    2FA screens change color and type with it.
  - Mockups load the font from Google Fonts; the app must not, so it works offline as a PWA and
    sends no request to a third party.
  - The references (Clio, MyCase, Filevine, Smokeball) were reviewed from their public product
    pages for patterns only; no assets or layouts were copied.
  - Deadline citations follow `docs/domain/neuquen-review.md`: the mockup's ordinary appeal
    deadline cites CPP art. 242 with a visible "[no verificado]" marker, as the screens must.

## ADR-0021: Design system in code (T20)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** ADR-0020 approved direction A "Limay" in `docs/design/DESIGN.md`. T20 turns it
  into Tailwind v4 tokens, a shadcn/ui theme and base components every screen will use.
- **Decision:**
  - Tokens live in `frontend/src/index.css` as **hex** CSS variables (`:root` and `.dark`),
    exactly as in DESIGN.md, exposed to Tailwind with `@theme inline` (`bg-detained-soft`,
    `text-status-efectiva`, `border-border-strong`...). `src/design-tokens.test.ts` reads that
    file and checks the same WCAG pairs as `scripts/contrast.mjs`, plus parity of light and dark.
  - **Tailwind's font-size scale is replaced** (`--text-*: initial`) by the product scale
    (`text-small` 15 px ... `text-display`), so nothing under 15 px can be written by accident.
    `text-display` and `text-time` grow at 768 px by overriding their variables in a media
    query. `cn()` uses `extendTailwindMerge` so these names are not mistaken for colors.
  - Font: `@fontsource-variable/atkinson-hyperlegible-next` 5.3.0 (variable 200–800,
    self-hosted, imported in `main.tsx`). Icons: `lucide-react` 1.77.0 (the shadcn default
    named in DESIGN.md; it was not installed yet).
  - Dark mode: `.dark` on `<html>` from `ThemeProvider` (choice "light" | "dark" | "system",
    stored under localStorage key `theme` inside try/catch) and an inline script in
    `index.html` that applies it before first paint. The toggle is a native radio group
    ("Claro", "Oscuro", "Según el sistema") so arrow keys and screen readers work for free.
  - Focus is one global `:focus-visible` rule (3 px `--ring`, 2 px offset); components do not
    use `outline-none`. Reduced motion sets durations to 0.01 ms instead of `none` so Radix exit
    animations still fire `animationend`. `MotionConfig` is left for when Motion is installed.
  - Components follow shadcn's structure (cva, `data-slot`, Radix primitives from `radix-ui`)
    and keep every target at 44 px or more. `Select` is the **native** `<select>`: the phone's
    own picker is better for this audience than a custom listbox. New tokens beyond DESIGN.md:
    `--overlay` (dialog scrim), `shadow-fab`, `shadow-segment`, `duration-fast`/`duration-base`.
  - Living style guide at `/design-system`; screenshots come from `npm run screenshots`
    (`playwright.screenshots.config.ts`, `e2e/*.capture.ts`), which is not part of the e2e run.
    The route ships in production builds on purpose: it shows only fictitious data, it is a
    portfolio showcase, and the e2e suite runs against the production preview. When auth
    lands (T21) it can move behind login or `import.meta.env.DEV` if that proves better.
- **Consequences:**
  - `text-sm`, `text-lg` and the rest of Tailwind's sizes no longer exist; use the product scale.
  - The PWA manifest `theme_color` is now `--primary`. Brand icons (favicon, PWA icons) are
    still the T03 placeholders and need a separate task.
  - The token values are written in three places (DESIGN.md, `scripts/contrast.mjs`,
    `index.css`); the Vitest test guards contrast on the one the app ships.

## ADR-0022: App shell, session handling and firm switcher (T21)

- **Date:** 2026-11-22
- **Status:** accepted
- **Context:** T21 adds the signed-in layout every screen will use, the two-step login of
  ADR-0009 and a way to move between firms. The backend binds an account to exactly one firm
  (tenant) and the session to that account, so there is no "switch tenant" endpoint.
- **Decision:**
  - **API client** (`src/lib/api.ts`): plain `fetch` with `credentials: "include"`. Every non-GET
    sends the `XSRF-TOKEN` cookie in `X-XSRF-TOKEN`, read fresh before each request (it rotates
    after login); if the cookie is missing it calls `GET /api/v1/auth/csrf` first. A 403 on a
    write refreshes the token and retries once (token rotated in another tab). Errors become
    `ApiError { status, type, retryAfter, detail }`, where `type` is the last segment of the
    problem `type` (`invalid-credentials`...). Network failures are `status 0`,
    `type "network-error"`. Queries do not retry 4xx.
  - **Session state** is the TanStack Query `["me"]` query (`GET /api/v1/me`, 401 → `null`).
    Route guards use `ensureQueryData`: the pathless `app` layout route redirects anonymous
    users to `/ingresar?redirect=<path>`; `/ingresar` sends signed-in users to `/`.
    `/design-system` stays public (ADR-0021) and is now lazy-loaded. A query/mutation cache
    subscriber turns **any 401** into "session gone": it sets `me` to `null` and opens the
    login keeping the current path. The `redirect` parameter only accepts same-origin paths
    (`/x`, not `//x` or URLs) to avoid an open redirect.
  - **Login** (`/ingresar`): React Hook Form + Zod (limits mirror the backend: 63/254/128/32).
    Step 2 accepts the TOTP (`inputMode="numeric"`, `autocomplete="one-time-code"`) or a
    recovery code (toggle "Usar un código de recuperación"). Wrong credentials get one generic
    message that never says which field failed; `login-throttled` shows the wait from
    `Retry-After` in words; `second-factor-expired` returns to the password step. Each failed
    attempt remounts the form so the secret field is emptied, focused and the error announced.
  - **Logout** clears the whole query cache. If the server cannot be reached the user stays
    signed in and sees "No pudimos cerrar la sesión": the UI never pretends a session was closed.
  - **Firm switcher**: switching firm = signing out + signing in to the other firm. The device
    remembers firms that signed in successfully in `localStorage["rememberedFirms"]`
    (`{slug, name, lastEmail}`, newest first, max 5, try/catch, validated on read). No
    passwords, tokens or case data. The email is personal data and survives a normal logout
    on purpose (convenience on the lawyer's own phone); "Olvidar" removes it. The switcher lists the current firm and the remembered
    ones; picking one signs out and opens `/ingresar?estudio=<slug>` with the slug and the
    remembered email filled in. The login also offers the remembered firms as shortcuts.
    "Olvidar este estudio en este dispositivo" asks for confirmation, signs out and removes
    the entry (meant for shared or borrowed devices).
  - **Navigation**: bottom nav below 1024 px (`lg`) with the four sections of DESIGN.md
    (Agenda, Causas, Plazos, Personas; 64 px items, safe-area inset), "Ajustes" in the account
    menu; sidebar from 1024 px with the same sections, then Ajustes, firm switcher and account
    menu at the foot. DESIGN.md said "Casos" and sidebar "≥ 1100 px"; we use **"Causas"**
    (the product's own word) and **`lg` (1024 px)** so tablets in landscape get the sidebar.
    Active section via `aria-current="page"`. Skip link "Saltar al contenido" to
    `<main id="contenido">`.
  - Account menu shows name, email, role in Spanish (Titular, Abogado/a, Procurador/a,
    Administrativo/a), theme choice (same three options as `ThemeToggle`) and "Cerrar sesión".
  - New tokens: `--spacing-sidebar`, `--spacing-top-bar`, `--spacing-bottom-nav`,
    `--container-content`, utilities `pt-safe`, `pb-safe`, `pb-bottom-nav-safe`;
    `viewport-fit=cover` in `index.html`. New base component: `DropdownMenu` (Radix).
  - Dependencies: `react-hook-form` 7.92.0, `zod` 4.6.7, `@hookform/resolvers` 7.0.8 (latest
    stable on npm at the time). Motion not added (no animation needed yet).
  - Tests mock `fetch` (`src/test/mock-api.ts`), not modules; e2e mocks the API with
    `page.route` (`e2e/mock-backend.ts`), so neither needs the backend running.
- **Consequences:** Every new screen is a child of the `app` route and gets the guard and the
  shell for free; pages render a `PageHeader` (one `h1`) and never their own `<main>`. A user
  with accounts in two firms signs in twice; that matches the security model (one session,
  one tenant). The main JS chunk is ~630 kB (≈199 kB gzip) and Vite warns above 500 kB;
  splitting routes (or `zod/mini`) is a follow-up when real screens land.
