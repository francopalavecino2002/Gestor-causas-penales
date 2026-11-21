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
