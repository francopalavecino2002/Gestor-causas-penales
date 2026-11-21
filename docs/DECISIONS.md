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
