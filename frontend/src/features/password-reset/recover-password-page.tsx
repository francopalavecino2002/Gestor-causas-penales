import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "@tanstack/react-router";
import { LoaderCircle, MailCheck } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordReset } from "@/features/auth/auth-api";
import { AuthLayout } from "@/features/auth/auth-layout";
import { credentialsSchema, EMAIL_MAX, TENANT_MAX } from "@/features/auth/login-schemas";
import { LOGIN_PATH } from "@/features/auth/redirect";
import { resetRequestMessage } from "@/features/password-reset/reset-errors";
import { findRememberedFirm } from "@/features/firms/remembered-firms";
import { ServerError } from "@/features/two-factor/two-factor-fields";

const recoverSchema = credentialsSchema.pick({ tenant: true, email: true });

type RecoverValues = z.infer<typeof recoverSchema>;

export interface RecoverPasswordSearch {
  /** Firm slug already typed on the login. */
  estudio?: string;
}

const textLink = "font-semibold text-primary underline underline-offset-4 hover:decoration-2";

/**
 * Asks for a password reset link (T71). The answer is the same whether or not the account exists,
 * so the confirmation only says what happens if it does.
 */
export function RecoverPasswordPage({ estudio }: RecoverPasswordSearch) {
  const [sent, setSent] = useState<RecoverValues | null>(null);
  const [error, setError] = useState<string>();
  const tenant = estudio?.trim().toLowerCase() ?? "";
  const {
    register,
    handleSubmit,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<RecoverValues>({
    resolver: zodResolver(recoverSchema),
    defaultValues: { tenant, email: findRememberedFirm(tenant)?.lastEmail ?? "" },
  });
  // "Volvé a ingresar" keeps the firm typed here.
  const typedTenant = useWatch({ control, name: "tenant" }).trim().toLowerCase();
  const loginSearch = typedTenant ? { estudio: typedTenant } : {};

  // Coming from the login with the firm typed, or back to ask again, the email is what is left.
  const [askedAgain, setAskedAgain] = useState(false);
  useEffect(() => {
    if (!sent && (tenant || askedAgain)) setFocus("email");
  }, [tenant, sent, askedAgain, setFocus]);

  const submit = handleSubmit(async (values) => {
    setError(undefined);
    try {
      await requestPasswordReset(values.tenant, values.email);
      setSent(values);
    } catch (failure) {
      setError(resetRequestMessage(failure));
    }
  });

  if (sent) {
    return (
      <AuthLayout>
        <SentNotice
          tenant={sent.tenant.toLowerCase()}
          onAgain={() => {
            setSent(null);
            setAskedAgain(true);
          }}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="grid gap-7">
        <header className="grid gap-2">
          <h1 className="text-display font-bold text-balance">Recuperá tu contraseña</h1>
          <p className="text-body text-muted-foreground">
            Escribí el estudio y el email de tu cuenta. Te mandamos un enlace para que elijas una
            contraseña nueva.
          </p>
        </header>

        <form noValidate onSubmit={submit} className="grid gap-5">
          <ServerError id="recover-error">{error}</ServerError>

          <Field>
            <Label htmlFor="recover-tenant">Estudio</Label>
            <Input
              id="recover-tenant"
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={TENANT_MAX}
              aria-invalid={errors.tenant ? true : undefined}
              aria-describedby={
                errors.tenant ? "recover-tenant-help recover-tenant-error" : "recover-tenant-help"
              }
              {...register("tenant")}
            />
            <FieldDescription id="recover-tenant-help">
              El identificador de tu estudio, por ejemplo{" "}
              <span className="whitespace-nowrap">estudio-demo</span>.
            </FieldDescription>
            <FieldError id="recover-tenant-error">{errors.tenant?.message}</FieldError>
          </Field>

          <Field>
            <Label htmlFor="recover-email">Email</Label>
            <Input
              id="recover-email"
              type="email"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={EMAIL_MAX}
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? "recover-email-error" : undefined}
              {...register("email")}
            />
            <FieldError id="recover-email-error">{errors.email?.message}</FieldError>
          </Field>

          <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {isSubmitting ? "Enviando…" : "Enviame el enlace"}
          </Button>
        </form>

        <p className="text-meta text-muted-foreground">
          ¿Te acordaste?{" "}
          <Link to={LOGIN_PATH} search={loginSearch} className={textLink}>
            Volvé a ingresar
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}

/** What happens next, in words that never say whether the account exists. */
function SentNotice({ tenant, onAgain }: { tenant: string; onAgain: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  // The form is gone: the focus moves to the news so a screen reader reads it next.
  useEffect(() => heading.current?.focus(), []);

  return (
    <section aria-labelledby="recover-sent" className="grid gap-7">
      <header className="grid gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <h1
          id="recover-sent"
          ref={heading}
          tabIndex={-1}
          className="text-display font-bold text-balance outline-none"
        >
          Revisá tu correo
        </h1>
        <div className="grid gap-3 text-body">
          <p>
            Si los datos corresponden a una cuenta, te mandamos un correo con un enlace. Vence en 30
            minutos.
          </p>
          <p className="text-muted-foreground">
            Si no lo ves en unos minutos, mirá en la carpeta de correo no deseado.
          </p>
        </div>
      </header>

      <div className="grid gap-3">
        <Button asChild size="lg" className="w-full">
          <Link to={LOGIN_PATH} search={tenant ? { estudio: tenant } : {}}>
            Volvé a ingresar
          </Link>
        </Button>
        <Button variant="ghost" className="w-full" onClick={onAgain}>
          Pedí otro enlace
        </Button>
      </div>
    </section>
  );
}
