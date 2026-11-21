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
