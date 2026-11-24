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
import { Users } from "lucide-react";

import { AppShell } from "@/components/shell/app-shell";
import { parseAgendaSearch } from "@/features/agenda/agenda-search";
import { CaseDetailPage } from "@/features/cases/case-detail-page";
import { CaseListPage } from "@/features/cases/case-list-page";
import { isCaseId, parseCaseListSearch } from "@/features/cases/case-search";
import { CaseNotFound } from "@/features/cases/case-states";
import { DeadlinesPage } from "@/features/deadlines/deadlines-page";
import { parseDeadlineSearch } from "@/features/deadlines/deadline-search";
import { LoginPage, type LoginSearch } from "@/features/auth/login-page";
import { meQueryOptions } from "@/features/auth/me-query";
import { LOGIN_PATH, loginSearchFor } from "@/features/auth/redirect";
import { ImportPage } from "@/features/imports/import-page";
import { CatalogsSection } from "@/features/settings/catalogs-section";
import { CustomFieldsSection } from "@/features/settings/custom-fields-section";
import { DeadlineRulesSection } from "@/features/settings/deadline-rules-section";
import { PracticeAreasSection } from "@/features/settings/practice-areas-section";
import { SettingsHomePage } from "@/features/settings/settings-layout";
import { parseCatalogSearch, parseFieldSearch } from "@/features/settings/settings-search";
import { UsersSection } from "@/features/settings/users-section";
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

/** Home: the hearing agenda. `?vista`, `?fecha` and `?abogado` keep the view linkable (T22). */
const agendaRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/",
  validateSearch: parseAgendaSearch,
  component: HomePage,
});

/** Case list. `?q`, `?pagina` and `?archivadas` keep a search linkable (T23). */
const casesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/causas",
  validateSearch: parseCaseListSearch,
  component: function CasesRoute() {
    const search = casesRoute.useSearch();
    return <CaseListPage search={search} />;
  },
});

/** Case detail, read only (ADR-0024). An id that cannot be a case is not found without asking. */
const caseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/causas/$caseId",
  component: function CaseRoute() {
    const { caseId } = caseRoute.useParams();
    return isCaseId(caseId) ? <CaseDetailPage key={caseId} caseId={caseId} /> : <CaseNotFound />;
  },
});

/** Deadlines that need attention (ADR-0025). `?dias` and `?detenidos` keep the view linkable (T24). */
const deadlinesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/plazos",
  validateSearch: parseDeadlineSearch,
  component: function DeadlinesRoute() {
    const search = deadlinesRoute.useSearch();
    return <DeadlinesPage search={search} />;
  },
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

/** Settings index and its sections (ADR-0026). Every member reads; only the owner changes. */
const settingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes",
  component: SettingsHomePage,
});

/** `?catalogo` keeps the chosen catalog linkable. */
const settingsCatalogsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes/catalogos",
  validateSearch: parseCatalogSearch,
  component: function SettingsCatalogsRoute() {
    const search = settingsCatalogsRoute.useSearch();
    return <CatalogsSection search={search} />;
  },
});

/** `?para=imputados` switches from the cases' fields to the defendants'. */
const settingsFieldsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes/campos",
  validateSearch: parseFieldSearch,
  component: function SettingsFieldsRoute() {
    const search = settingsFieldsRoute.useSearch();
    return <CustomFieldsSection search={search} />;
  },
});

/** The practice areas the firm works in (ADR-0032). */
const settingsAreasRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes/fueros",
  component: PracticeAreasSection,
});

const settingsRulesRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes/plazos",
  component: DeadlineRulesSection,
});

const settingsUsersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/ajustes/usuarios",
  component: UsersSection,
});

/** Import wizard (ADR-0027): reached from Ajustes and from the empty case list. */
const importRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/importar",
  component: ImportPage,
});

const routeTree = rootRoute.addChildren([
  loginRoute,
  designSystemRoute,
  appRoute.addChildren([
    agendaRoute,
    casesRoute,
    caseRoute,
    deadlinesRoute,
    personsRoute,
    settingsRoute,
    settingsAreasRoute,
    settingsCatalogsRoute,
    settingsFieldsRoute,
    settingsRulesRoute,
    settingsUsersRoute,
    importRoute,
  ]),
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
