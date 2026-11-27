import { useId, useState, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { passwordFailure, type PasswordFailure } from "@/features/account/password-errors";
import {
  NEW_PASSWORD_MIN,
  passwordChangeSchema,
  type PasswordChangeValues,
} from "@/features/account/password-schema";
import { SecretField } from "@/features/account/secret-field";
import { changeOwnPassword } from "@/features/auth/auth-api";
import { useMe } from "@/features/auth/me-query";
import { useLeaveSession } from "@/features/auth/use-logout";
import { ServerError } from "@/features/two-factor/two-factor-fields";
import { cn } from "@/lib/utils";

/**
 * Current password, new one and the new one again. On success the server has already ended every
 * session of the user, so the screen goes to the login with "Listo. Ingresá con tu contraseña
 * nueva." and the firm prefilled. Nothing typed here is kept: the mutation is dropped right away.
 */
export function PasswordChangeForm({
  current,
  submitLabel,
  onPendingChange,
  stretch = false,
  className,
  children,
}: {
  /** The submit button takes the whole width, as in the login. */
  stretch?: boolean;
  /** "temporal" when replacing the password the owner gave: the copy says so. */
  current: "actual" | "temporal";
  submitLabel: string;
  /** Tells a dialog to stay open while the request runs. */
  onPendingChange?: (pending: boolean) => void;
  className?: string;
  /** Extra actions next to the submit button (e.g. "Cancelá"). */
  children?: ReactNode;
}) {
  const id = useId();
  const { data: me } = useMe();
  const leave = useLeaveSession();
  const change = useMutation({
    mutationFn: ({ currentPassword, newPassword }: PasswordChangeValues) =>
      changeOwnPassword(currentPassword, newPassword),
    gcTime: 0,
  });
  const [failure, setFailure] = useState<PasswordFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<PasswordChangeValues>({
    resolver: zodResolver(passwordChangeSchema(current)),
    defaultValues: { currentPassword: "", newPassword: "", repeatPassword: "" },
  });

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    onPendingChange?.(true);
    try {
      await change.mutateAsync(values);
      await leave({ estudio: me?.tenant.slug, aviso: "contrasena-cambiada" });
    } catch (error) {
      const next = passwordFailure(error, current);
      setFailure(next);
      if (next.field === "currentPassword") {
        resetField("currentPassword");
        setFocus("currentPassword");
      } else if (next.field === "newPassword") {
        resetField("newPassword");
        resetField("repeatPassword");
        setFocus("newPassword");
      }
    } finally {
      onPendingChange?.(false);
      // The passwords must not linger in the mutation cache.
      change.reset();
    }
  });

  const serverId = `${id}-server`;
  const currentLabel = current === "temporal" ? "Contraseña temporal" : "Tu contraseña actual";

  return (
    <form noValidate onSubmit={submit} className={cn("grid gap-5", className)}>
      <ServerError id={serverId}>{failure?.message}</ServerError>
      <SecretField
        id={`${id}-current`}
        label={currentLabel}
        toggleLabel={
          current === "temporal" ? "Mostrar la contraseña temporal" : "Mostrar tu contraseña actual"
        }
        autoComplete="current-password"
        registration={register("currentPassword")}
        error={errors.currentPassword?.message}
        serverErrorId={failure?.field === "currentPassword" ? serverId : undefined}
        help={
          current === "temporal"
            ? "La que te dio la persona titular del estudio, con los guiones."
            : undefined
        }
      />
      <SecretField
        id={`${id}-new`}
        label="Contraseña nueva"
        toggleLabel="Mostrar la contraseña nueva"
        autoComplete="new-password"
        registration={register("newPassword")}
        error={errors.newPassword?.message}
        serverErrorId={failure?.field === "newPassword" ? serverId : undefined}
        help={`Al menos ${NEW_PASSWORD_MIN} caracteres. Una frase de cuatro o cinco palabras es fácil de recordar y difícil de adivinar.`}
      />
      <SecretField
        id={`${id}-repeat`}
        label="Repetí la contraseña nueva"
        toggleLabel="Mostrar la contraseña repetida"
        autoComplete="new-password"
        registration={register("repeatPassword")}
        error={errors.repeatPassword?.message}
      />
      <div className={cn("flex flex-col-reverse gap-2", !stretch && "sm:flex-row sm:justify-end")}>
        {children}
        <Button
          type="submit"
          size="lg"
          className={cn("w-full", !stretch && "sm:w-fit")}
          disabled={isSubmitting}
        >
          {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
          {isSubmitting ? "Guardando…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
