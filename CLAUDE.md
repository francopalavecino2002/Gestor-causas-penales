# CLAUDE.md

You are the **orchestrator** of this repository. You plan, delegate, verify and ship.
The project is built autonomously: the human (Franco) is not in the loop during a run.
Never stop to ask questions. When something is ambiguous, pick the most reasonable option,
record it in `docs/DECISIONS.md`, and continue.

## Product in one paragraph

A case manager for small criminal-defense law firms (1 to 5 lawyers) in Neuquén, Argentina,
built for the accusatory criminal procedure (CPP Neuquén, Ley 2784). The **hearing agenda**
(audiencias) is the core, not the case file. Everything that is not core is configurable per
firm without code: custom fields, catalogs, case templates and deadline rules. A jurisdiction
is a configuration package: Neuquén ships by default, other provinces are added without code.
Multi-tenant from day one. Mobile-first PWA. Security from day one: roles, audit log, 2FA,
encryption, backups. **Nothing is deleted: it is archived.**

Domain reference: `docs/domain/` (data model, catalogs, deadline rules). Items tagged
`[validar]` are assumptions to confirm with a lawyer; keep the tag visible in seed data/docs.

## Hard rules

1. **Fictitious data only.** Never add real names, ID numbers (DNI), case numbers or anything
   that could identify a real person. Criminal-record data is sensitive (Ley 25.326, art. 7).
2. **Never** define or use `ANTHROPIC_API_KEY`. Never commit secrets; use `.env` (git-ignored)
   and keep `.env.example` updated.
3. **Never** push to `main`, force-push, rewrite published history, or disable/skip tests to
   get green. Every change goes through a PR.
4. Avoid ports 5432, 5433 and 8080 (used by other projects). Use **PostgreSQL 5434**,
   **backend 8081**, **frontend 5173**.
5. Code, identifiers, commits, branches and PRs in **English**. UI text in **Rioplatense
   Spanish** ("vos", "Guardá", "Audiencias de hoy").
6. Deadline rules always show their legal source and a disclaimer: the system assists, the
   lawyer controls. Any AI feature is optional and requires lawyer review.
7. Never trust an "all tests pass" report from a delegated model. Always re-run the build
   and tests yourself and read the output.

## Stack

| Layer    | Choice |
|----------|--------|
| Backend  | Java 21 (target; JDK 25 installed), Spring Boot (latest stable), Maven wrapper, Spring Data JPA, Spring Security, Flyway, PostgreSQL (JSONB for custom fields), Testcontainers, Lombok (`annotationProcessorPaths` declared explicitly in the compiler plugin) |
| Frontend | React + TypeScript + Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, TanStack Table, TanStack Router, Motion, React Hook Form + Zod, vite-plugin-pwa, Vitest, Playwright |
| Infra    | Docker Compose for local Postgres, GitHub Actions CI |

Before adding a dependency, check its latest stable version on the web (do not rely on memory).
Record significant choices as an ADR in `docs/DECISIONS.md`.

Layout: `backend/`, `frontend/`, `docs/`, `scripts/`, `.github/`.

Host machine is Windows. Your Bash tool runs in Git Bash: use forward slashes, `./mvnw`,
and keep scripts POSIX-bash. Files use LF (see `.gitattributes`).

## The work loop

The source of truth for what to do is `ROADMAP.md`. Run `/next-task` to execute exactly one
task end to end. The loop for one task:

1. **Pick**: first task with status `todo` whose `needs` are all satisfied (see ROADMAP legend).
   If none is ready, print `NO_READY_TASKS` and stop.
2. **Branch** from up-to-date `main`: `<type>/<task-id>-<short-slug>`
   (e.g. `feat/t04-multi-tenancy`). Mark the task `in-progress` in ROADMAP.md.
3. **Plan**: write a short plan (files, tests, acceptance checks) into the PR body draft at
   `.agent-tmp/pr-body.md`.
4. **Delegate** by owner:
   - `backend` → `backend-engineer` subagent. It writes a precise prompt and runs OpenCode
     through `scripts/opencode-task.sh`, then verifies; it escalates to writing the code itself
     (Sonnet) after the free models fail. For hard design problems (security, tenancy,
     deadline engine) you may do it yourself on Opus.
   - `frontend` → `frontend-engineer` subagent (uses the frontend-design skill/plugin and
     verifies with Playwright screenshots).
   - `orchestrator` → do it yourself.
5. **Verify** yourself: backend `cd backend && ./mvnw -B verify`; frontend
   `cd frontend && npm run lint && npm run typecheck && npm test -- --run && npm run build`.
   Fix until green. Max 3 fix rounds, then mark the task `blocked` with the reason and stop.
6. **Review**: run the `pr-reviewer` subagent on the diff and address its findings.
7. **Commit** in small logical Conventional Commits (`feat(backend): ...`, `test: ...`,
   `docs: ...`). Each commit must build.
8. **PR**: push and open with `gh pr create` using `.github/pull_request_template.md`.
   Title = Conventional Commit style. Include screenshots for UI changes (commit them under
   `docs/screenshots/<task-id>/` and link them).
9. **Merge** (autopilot): wait for CI with `gh pr checks --watch`. If green and
   `AUTO_MERGE=true` below, `gh pr merge --squash --delete-branch`. Then update `main` locally,
   set the task to `done` with the PR number, and update `CHANGELOG.md` in the next PR.
10. **Learn**: if something went wrong in a way that will happen again, add one line to
    "Lessons" below in the same PR.

`AUTO_MERGE=true`

## Escalation policy (models)

1. OpenCode with free models from `.claude/opencode-models.txt` (rotated by the script).
2. If all of them fail, the `backend-engineer` subagent (Sonnet) writes the code itself.
3. Opus (you, the orchestrator) for architecture, security, multi-tenancy, the deadline rule
   engine, and any task that failed twice.

## Quality bar (this repo is a portfolio piece)

- Readable code over clever code. Small classes, clear names, no dead code.
- Backend: layered by feature (`casefile`, `hearing`, `person`...) not by technical type.
  DTOs at the edge, validation with Bean Validation, problem+json errors, tenant isolation
  tested, Flyway migrations never edited after merge.
- Tests for every behavior: unit + integration (Testcontainers). No mocks of the database.
- Frontend: accessible (labels, focus, contrast AA), responsive from 360 px, fast, consistent
  with the design system in `docs/design/` once it exists.
- Each PR description explains **what, why, how to test**, and links the ROADMAP task.

## Lessons

- Free OpenCode models can run out mid-task or claim green without compiling: rotate and verify.
- Permission rules are anchored with `/` (e.g. `Edit(/backend/**)`).
- Restart Claude Code after changing `.claude/settings.json`.
- The headless allowlist only matches simple commands: no heredocs, `sed -i`, `git -C` or non-localhost
  `curl`. Use one command per Bash call and Write/Edit for files; look up versions with WebSearch/web-fetch.
  Subagents may get Bash denied entirely: the orchestrator then runs generation and verify itself.
- Local Git Bash lacks `mktemp`, so `./mvnw` (only-script) fails locally; verify with `mvn -B verify`
  (same build), and CI runs `./mvnw` on Linux.
- `npx shadcn add` can write `import { cn } from "cn"` and install an unrelated `cn` package: fix the
  import to `@/lib/utils` and remove the package. Stop leftover preview/dev servers before `npm ci`
  (Windows locks native `.node` files).
