import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { LinkIcon, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { passwordFailure, type PasswordFailure } from "@/features/account/password-errors";
import {
  NEW_PASSWORD_MIN,
  passwordResetSchema,
  type PasswordResetValues,
} from "@/features/account/password-schema";
import { SecretField } from "@/features/account/secret-field";
import { confirmPasswordReset } from "@/features/auth/auth-api";
import { AuthLayout } from "@/features/auth/auth-layout";
import { ME_QUERY_KEY } from "@/features/auth/me-query";
import { LOGIN_PATH, RECOVER_PASSWORD_PATH } from "@/features/auth/redirect";
import { ServerError } from "@/features/two-factor/two-factor-fields";
import { isApiError } from "@/lib/api";

export interface ResetPasswordPageProps {
  /** Firm slug from the link, to prefill the login afterwards. */
  estudio?: string;
  /** The token of the link, already taken out of the address bar; undefined when missing. */
  token: string | undefined;
}

const SERVER_ERROR_ID = "reset-server-error";

/**
 * Chooses a new password with the emailed link (T71). On success every session of the user is
 * closed and the login opens with the firm prefilled; the second factor is still asked there.
 */
export function ResetPasswordPage({ estudio, token }: ResetPasswordPageProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const firm = estudio?.trim().toLowerCase() || undefined;
  // "rejected": the server said the link is not valid anymore, so the news gets the focus.
  const [linkState, setLinkState] = useState<"usable" | "missing" | "rejected">(
    token ? "usable" : "missing",
  );
  const [failure, setFailure] = useState<PasswordFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<PasswordResetValues>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { newPassword: "", repeatPassword: "" },
  });

  const submit = handleSubmit(async ({ newPassword }) => {
    if (!token) return;
    setFailure(null);
    try {
      await confirmPasswordReset(token, newPassword);
    } catch (error) {
      if (isApiError(error) && error.type === "invalid-reset-token") {
        setLinkState("rejected");
        return;
      }
      const next = passwordFailure(error, "actual");
      setFailure(next);
      if (next.field === "newPassword") {
        resetField("newPassword");
        resetField("repeatPassword");
        setFocus("newPassword");
      }
      return;
    }
    // Any session on this device was closed too: the login must ask /me again.
    queryClient.removeQueries({ queryKey: ME_QUERY_KEY });
    await navigate({
      to: LOGIN_PATH,
      search: { ...(firm ? { estudio: firm } : {}), aviso: "clave-restablecida" },
    });
  });

  if (linkState !== "usable") {
    return (
      <AuthLayout>
        <InvalidLink estudio={firm} focus={linkState === "rejected"} />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-display font-bold text-balance">Elegí una contraseña nueva</h1>
          <p className="text-body text-muted-foreground">
            {firm ? (
              <>
                Es para tu cuenta en <span className="font-semibold break-all">{firm}</span>.{" "}
              </>
            ) : null}
            Después vas a ingresar con ella como siempre.
          </p>
        </header>

        <form noValidate onSubmit={submit} className="grid gap-5">
          <ServerError id={SERVER_ERROR_ID}>{failure?.message}</ServerError>
          <SecretField
            id="reset-new"
            label="Nueva contraseña"
            toggleLabel="Mostrar la nueva contraseña"
            autoComplete="new-password"
            registration={register("newPassword")}
            error={errors.newPassword?.message}
            serverErrorId={failure?.field === "newPassword" ? SERVER_ERROR_ID : undefined}
            help={`Al menos ${NEW_PASSWORD_MIN} caracteres. Una frase de cuatro o cinco palabras es fácil de recordar y difícil de adivinar.`}
          />
          <SecretField
            id="reset-repeat"
            label="Repetila"
            toggleLabel="Mostrar la contraseña repetida"
            autoComplete="new-password"
            registration={register("repeatPassword")}
            error={errors.repeatPassword?.message}
          />
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {isSubmitting ? "Guardando…" : "Guardá la contraseña nueva"}
          </Button>
        </form>
      </div>
    </AuthLayout>
  );
}

/** The link is missing, malformed, used or expired: the way out is asking for a new one. */
function InvalidLink({ estudio, focus }: { estudio: string | undefined; focus: boolean }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (focus) heading.current?.focus();
  }, [focus]);
  const search = estudio ? { estudio } : {};

  return (
    <section aria-labelledby="reset-invalid" className="grid gap-7">
      <header className="grid gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <LinkIcon aria-hidden="true" className="size-6" />
        </span>
        <h1
          id="reset-invalid"
          ref={heading}
          tabIndex={-1}
          className="text-display font-bold text-balance outline-none"
        >
          El enlace no es válido o venció
        </h1>
        <p className="text-body">
          Cada enlace sirve una sola vez y vence a los 30 minutos. Pedí uno nuevo y usalo apenas te
          llegue.
        </p>
      </header>
      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link to={RECOVER_PASSWORD_PATH} search={search}>
            Pedí un enlace nuevo
          </Link>
        </Button>
        <Button asChild variant="ghost" className="w-full">
          <Link to={LOGIN_PATH} search={search}>
            Volvé a ingresar
          </Link>
        </Button>
      </div>
    </section>
  );
}
