import { useId, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { useMe } from "@/features/auth/me-query";
import { TWO_FACTOR_ANCHOR } from "@/features/two-factor/two-factor-format";

/** "Ahora no" hides the prompt for this browser session only: it comes back on the next one. */
const DISMISSED_KEY = "twoFactorPromptDismissed";

function readDismissed(): boolean {
  try {
    return window.sessionStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveDismissed() {
  try {
    window.sessionStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // No storage (private mode, blocked site data): it hides until the page reloads.
  }
}

/**
 * A calm nudge on the Ajustes index for the owner without a second factor: the owner's account
 * can change the whole firm's setup, so it is the one that most needs it.
 */
export function TwoFactorPrompt() {
  const titleId = useId();
  const { data: me } = useMe();
  const [dismissed, setDismissed] = useState(readDismissed);

  if (!me || me.role !== "OWNER" || me.twoFactorEnabled || dismissed) return null;

  return (
    <section
      aria-labelledby={titleId}
      className="grid max-w-3xl gap-4 rounded-xl border border-l-6 border-l-primary bg-card px-4 py-4 sm:grid-cols-[auto_minmax(0,1fr)] md:px-5"
    >
      <span
        aria-hidden="true"
        className="hidden size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground sm:inline-flex"
      >
        <ShieldCheck className="size-6" />
      </span>
      <div className="grid gap-3">
        <div className="grid gap-1">
          <h2 id={titleId} className="text-card-title font-bold text-balance">
            Sumá la verificación en dos pasos a tu cuenta
          </h2>
          <p className="max-w-prose text-meta text-muted-foreground">
            Como titular, desde tu cuenta se cambia la configuración de todo el estudio. Con un
            código de tu celular, nadie entra aunque sepa tu contraseña. Te toma dos minutos.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            to="/ajustes/usuarios"
            hash={TWO_FACTOR_ANCHOR}
            className={buttonVariants({ className: "w-full sm:w-fit" })}
          >
            Activala ahora
          </Link>
          <Button
            variant="ghost"
            className="w-full sm:w-fit"
            onClick={() => {
              saveDismissed();
              setDismissed(true);
            }}
          >
            Ahora no
          </Button>
        </div>
      </div>
    </section>
  );
}
