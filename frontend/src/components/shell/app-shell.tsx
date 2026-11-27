import { Outlet } from "@tanstack/react-router";
import { CircleAlert } from "lucide-react";

import { BottomNav } from "@/components/shell/bottom-nav";
import type { FirmSwitchRequest } from "@/components/shell/firm-switcher";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ForcedPasswordPage } from "@/features/account/forced-password-page";
import { useMe } from "@/features/auth/me-query";
import { useLogout } from "@/features/auth/use-logout";

/**
 * Layout of every signed-in screen: skip link, sidebar (≥ 1024 px) or top bar + bottom nav
 * (< 1024 px), and the page in <main id="contenido">.
 */
export function AppShell() {
  const { data: me } = useMe();
  const logout = useLogout();

  // The guard guarantees a user; null only lasts until the 401 handler opens the login.
  if (!me) return null;
  // A temporary password: the server refuses everything else, so the app is not shown at all.
  if (me.passwordChangeRequired) return <ForcedPasswordPage me={me} />;

  const switchFirm = (request: FirmSwitchRequest) => logout.mutate(request);
  const signOut = () => logout.mutate({});

  return (
    <div className="min-h-dvh lg:pl-sidebar">
      <a
        href="#contenido"
        className="fixed top-2 left-2 z-50 -translate-y-24 rounded-lg bg-primary px-4 py-2.5 text-meta font-bold text-primary-foreground focus-visible:translate-y-0"
      >
        Saltar al contenido
      </a>

      <TopBar me={me} onSwitchFirm={switchFirm} onLogout={signOut} />
      <Sidebar me={me} onSwitchFirm={switchFirm} onLogout={signOut} />

      <main
        id="contenido"
        tabIndex={-1}
        className="px-4 pt-6 pb-bottom-nav-safe sm:px-8 sm:pt-8 lg:px-10 lg:pt-10 lg:pb-10"
      >
        <div className="mx-auto grid max-w-content gap-7">
          {logout.isError && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertTitle>No pudimos cerrar la sesión</AlertTitle>
              <AlertDescription>
                Revisá tu conexión a internet y probá de nuevo. Mientras tanto, la sesión sigue
                abierta en este dispositivo.
              </AlertDescription>
            </Alert>
          )}
          <Outlet />
        </div>
      </main>

      <BottomNav />
    </div>
  );
}
