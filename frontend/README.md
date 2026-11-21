# Frontend

React + TypeScript single-page app (mobile-first PWA) for Gestor de causas penales.

Stack: Vite, Tailwind CSS v4, shadcn/ui, TanStack Router (code-based routes in
`src/router.tsx`), TanStack Query, vite-plugin-pwa, Vitest + Testing Library, Playwright.

## Requirements

- Node.js 22.12 or newer.
- The backend on `http://localhost:8081` for anything under `/api` (proxied by Vite).

## Commands

| Command                | What it does                                                   |
| ---------------------- | -------------------------------------------------------------- |
| `npm ci`               | Install the exact dependencies from `package-lock.json`.       |
| `npm run dev`          | Dev server on http://localhost:5173 (`/api` -> 8081).          |
| `npm run build`        | Type-check and build to `dist/` (includes the service worker). |
| `npm run preview`      | Serve the build on http://localhost:4173.                      |
| `npm run lint`         | ESLint.                                                        |
| `npm run typecheck`    | TypeScript project references, no emit.                        |
| `npm test`             | Vitest in watch mode (`npm test -- --run` for a single run).   |
| `npm run test:e2e`     | Playwright smoke tests against the production build.           |
| `npm run format`       | Format with Prettier.                                          |
| `npm run format:check` | Check formatting (no writes).                                  |

The first time you run the end-to-end tests, install the browser with
`npx playwright install chromium`.

## Layout

```
src/
  components/ui/  shadcn/ui components (added with `npx shadcn@latest add <name>`)
  lib/            utilities (`cn`, query client)
  pages/          one component per screen, with its tests next to it
  test/           Vitest setup and render helpers
  router.tsx      route tree
e2e/              Playwright tests
public/           static assets and PWA icons
```

The `@/` import alias points to `src/`.
