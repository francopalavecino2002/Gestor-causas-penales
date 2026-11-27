import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { Link } from "@tanstack/react-router";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  credentialsSchema,
  EMAIL_MAX,
  PASSWORD_MAX,
  TENANT_MAX,
  type CredentialsValues,
} from "@/features/auth/login-schemas";
import { RECOVER_PASSWORD_PATH } from "@/features/auth/redirect";
import type { RememberedFirm } from "@/features/firms/remembered-firms";

interface PasswordStepProps {
  defaultValues: Pick<CredentialsValues, "tenant" | "email">;
  /** Firms used on this device, offered as shortcuts when the form starts empty. */
  rememberedFirms: RememberedFirm[];
  /** Server error from the last attempt, already in words. */
  error: string | undefined;
  onSubmit: (values: CredentialsValues) => Promise<void>;
}

export function PasswordStep({
  defaultValues,
  rememberedFirms,
  error,
  onSubmit,
}: PasswordStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CredentialsValues>({
    resolver: zodResolver(credentialsSchema),
    defaultValues: { ...defaultValues, password: "" },
  });
  // The recovery link carries the firm already typed, so it is not asked twice.
  const tenant = useWatch({ control, name: "tenant" });

  // Coming from the firm switcher (or back from an expired code), the firm is already there.
  useEffect(() => {
    if (defaultValues.tenant) setFocus(defaultValues.email ? "password" : "email");
  }, [defaultValues.tenant, defaultValues.email, setFocus]);

  const pickFirm = (firm: RememberedFirm) => {
    setValue("tenant", firm.slug, { shouldValidate: true });
    setValue("email", firm.lastEmail, { shouldValidate: Boolean(firm.lastEmail) });
    setFocus(firm.lastEmail ? "password" : "email");
  };

  const showShortcuts = rememberedFirms.length > 0 && !defaultValues.tenant;

  return (
    <div className="grid gap-7">
      <header className="grid gap-2">
        <h1 className="text-display font-bold text-balance">Ingresá a tu estudio</h1>
        <p className="text-body text-muted-foreground">
          Usá el email y la contraseña de tu cuenta.
        </p>
      </header>

      {showShortcuts && (
        <section aria-labelledby="remembered-firms" className="grid gap-2">
          <h2 id="remembered-firms" className="text-meta font-bold">
            Estudios usados en este dispositivo
          </h2>
          <ul className="grid gap-2">
            {rememberedFirms.map((firm) => (
              <li key={firm.slug}>
                <button
                  type="button"
                  onClick={() => pickFirm(firm)}
                  className="grid min-h-11 w-full cursor-pointer gap-0.5 rounded-lg border bg-card px-3.5 py-2.5 text-left transition-colors duration-fast ease-out hover:bg-accent"
                >
                  <span className="text-body font-semibold">{firm.name}</span>
                  <span className="text-small break-all text-muted-foreground">
                    {firm.lastEmail || firm.slug}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <form noValidate onSubmit={handleSubmit(onSubmit)} className="grid gap-5">
        {error && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Field>
          <Label htmlFor="login-tenant">Estudio</Label>
          <Input
            id="login-tenant"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={TENANT_MAX}
            aria-invalid={errors.tenant ? true : undefined}
            aria-describedby={
              errors.tenant ? "login-tenant-help login-tenant-error" : "login-tenant-help"
            }
            {...register("tenant")}
          />
          <FieldDescription id="login-tenant-help">
            El identificador de tu estudio, por ejemplo{" "}
            <span className="whitespace-nowrap">estudio-demo</span>.
          </FieldDescription>
          <FieldError id="login-tenant-error">{errors.tenant?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            inputMode="email"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={EMAIL_MAX}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "login-email-error" : undefined}
            {...register("email")}
          />
          <FieldError id="login-email-error">{errors.email?.message}</FieldError>
        </Field>

        <Field>
          <Label htmlFor="login-password">Contraseña</Label>
          <div className="relative">
            <Input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={PASSWORD_MAX}
              className="pr-12"
              aria-invalid={errors.password ? true : undefined}
              aria-describedby={errors.password ? "login-password-error" : undefined}
              {...register("password")}
            />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0 right-0 text-muted-foreground"
              aria-label="Mostrar contraseña"
              aria-pressed={showPassword}
              aria-controls="login-password"
              onClick={() => setShowPassword((shown) => !shown)}
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
          <FieldError id="login-password-error">{errors.password?.message}</FieldError>
          <Link
            to={RECOVER_PASSWORD_PATH}
            search={tenant.trim() ? { estudio: tenant.trim().toLowerCase() } : {}}
            className="inline-flex min-h-11 w-fit items-center text-meta font-semibold text-primary underline underline-offset-4 hover:decoration-2"
          >
            ¿Olvidaste tu contraseña?
          </Link>
        </Field>

        <Button type="submit" size="lg" className="mt-1 w-full" disabled={isSubmitting}>
          {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? "Ingresando…" : "Ingresá"}
        </Button>
      </form>
    </div>
  );
}
