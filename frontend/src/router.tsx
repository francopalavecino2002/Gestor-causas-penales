import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  redirect,
  type RouterHistory,
} from "@tanstack/react-router";
import { Folder, Hourglass, Settings, Users } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { LoginPage, type LoginSearch } from "@/features/auth/login-page";
import { meQueryOptions } from "@/features/auth/me-query";
import { LOGIN_PATH, loginSearchFor } from "@/features/auth/redirect";
import { HomePage } from "@/pages/home-page";
import { NotFoundPage } from "@/pages/not-found-page";
import { PlaceholderPage } from "@/pages/placeholder-page";
import { SessionErrorPage } from "@/pages/session-error-page";

export interface RouterContext {
  queryClient: QueryClient;
}

// Code-based route tree: small and explicit while the app has a handful of screens.
const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: NotFoundPage,
});

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Public. Signed-in users go straight to the agenda. */
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: LOGIN_PATH,
  validateSearch: (search: Record<string, unknown>): LoginSearch => ({
    redirect: optionalString(search.redirect),
    estudio: optionalString(search.estudio),
  }),
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (me) throw redirect({ to: "/" });
  },
  errorComponent: ({ error }) => <SessionErrorPage error={error} />,
  component: function LoginRoute() {
    const search = loginRoute.useSearch();
    return <LoginPage {...search} />;
  },
});

/** Public style guide (ADR-0021). Loaded on demand: users never need it. */
const designSystemRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/design-system",
  component: lazyRouteComponent(() => import("@/pages/design-system-page"), "DesignSystemPage"),
});

/** Every signed-in screen lives under this layout; anonymous visitors go to the login. */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context, location }) => {
    const me = await context.queryClient.ensureQueryData(meQueryOptions);
    if (!me) {
      throw redirect({ to: LOGIN_PATH, search: loginSearchFor(location.href) });
    }
  },
  errorComponent: ({ error }) => <SessionErrorPage error={error} />,
  component: AppShell,
});

const agendaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  component: HomePage,
});

const casesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/causas",
  component: () => (
    <PlaceholderPage
      title="Causas"
      icon={Folder}
      description="Acá vas a encontrar las causas del estudio, con sus imputados, el legajo y las próximas audiencias."
    />
  ),
});

const deadlinesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/plazos",
  component: () => (
    <PlaceholderPage
      title="Plazos"
      icon={Hourglass}
      description="Acá vas a ver los plazos que vencen, cada uno con su fuente legal. El cálculo es asistido: siempre lo verificás con la norma."
    />
  ),
});

const personsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/personas",
  component: () => (
    <PlaceholderPage
      title="Personas"
      icon={Users}
      description="Acá vas a tener a tus defendidos y a las demás personas de las causas, con sus datos de contacto."
    />
  ),
});

const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes",
  component: () => (
    <PlaceholderPage
      title="Ajustes"
      icon={Settings}
      description="Acá vas a configurar el estudio: el equipo, los catálogos, los campos propios y la verificación en dos pasos."
    />
  ),
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  designSystemRoute,
  appRoute.addChildren([agendaRoute, casesRoute, deadlinesRoute, personsRoute, settingsRoute]),
]);

/** Builds the router; tests pass a memory history, the app uses the browser one. */
export function createAppRouter(options: { queryClient: QueryClient; history?: RouterHistory }) {
  return createRouter({
    routeTree,
    history: options.history,
    context: { queryClient: options.queryClient },
  });
}

export type AppRouter = ReturnType<typeof createAppRouter>;

declare module "@tanstack/react-router" {
  interface Register {
    router: AppRouter;
  }
}
