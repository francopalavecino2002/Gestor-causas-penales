import type { ReactNode } from "react";

import { BrandMark } from "@/components/shell/brand-mark";
import { LoginPanel } from "@/features/auth/login-panel";

/**
 * The frame of the screens before signing in (login, password recovery): the brand panel on wide
 * screens and one narrow column for the form.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <LoginPanel />
      <main
        id="contenido"
        className="flex min-h-dvh flex-col px-4 pt-6 pb-10 sm:px-8 lg:justify-center lg:px-10"
      >
        <div className="mx-auto grid w-full max-w-md gap-10">
          <BrandMark className="lg:hidden" />
          {children}
        </div>
      </main>
    </div>
  );
}
