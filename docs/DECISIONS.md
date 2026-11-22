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
