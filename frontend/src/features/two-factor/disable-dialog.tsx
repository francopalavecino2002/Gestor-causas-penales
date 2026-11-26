import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { holdOpen, type CloseGuard } from "@/features/two-factor/close-guard";
import { StepTitle } from "@/features/two-factor/two-factor-dialog";
import { twoFactorFailure, type TwoFactorFailure } from "@/features/two-factor/two-factor-errors";
import { CodeField, PasswordField, ServerError } from "@/features/two-factor/two-factor-fields";
import { useDisableTwoFactor } from "@/features/two-factor/two-factor-queries";
import {
  disableSchema,
  type CodeMode,
  type DisableValues,
} from "@/features/two-factor/two-factor-schemas";

/** Turning the second factor off needs both the password and a code, like the backend asks. */
export function DisableFlow({
  closeGuardRef,
  onDisabled,
}: {
  closeGuardRef: CloseGuard;
  onDisabled: () => void;
}) {
  const id = useId();
  const disable = useDisableTwoFactor();
  const [mode, setMode] = useState<CodeMode>("totp");
  const [failure, setFailure] = useState<TwoFactorFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<DisableValues>({
    resolver: zodResolver(disableSchema(mode)),
    defaultValues: { password: "", code: "" },
  });

  const changeMode = (next: CodeMode) => {
    setFailure(null);
    resetField("code");
    setMode(next);
    setFocus("code");
  };

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    // Same as the other flows: the screen must learn how the request ended.
    const release = holdOpen(closeGuardRef);
    try {
      await disable.mutateAsync(values);
      onDisabled();
    } catch (error) {
      const next = twoFactorFailure(error, "disable");
      setFailure(next);
      if (next.invalidInput) {
        // The server does not say which one failed: ask for both again.
        resetField("password");
        resetField("code");
        setFocus("password");
      }
    } finally {
      release();
      disable.reset();
    }
  });

  const serverErrorId = failure?.invalidInput ? `${id}-server` : undefined;

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>¿Desactivás la verificación en dos pasos?</StepTitle>
        <DialogDescription>
          Vas a volver a ingresar solo con la contraseña. Tus códigos de recuperación dejan de
          funcionar.
        </DialogDescription>
      </DialogHeader>

      <Alert variant="deadline">
        <ShieldAlert aria-hidden="true" />
        <AlertTitle>Tu cuenta queda menos protegida</AlertTitle>
        <AlertDescription>
          <p>
            Quien consiga tu contraseña podría ver las causas, los imputados y la agenda del
            estudio. Desactivala solo si vas a cambiar de celular, y volvé a activarla enseguida.
          </p>
        </AlertDescription>
      </Alert>

      <form noValidate onSubmit={submit} className="grid gap-5">
        <ServerError id={`${id}-server`}>{failure?.message}</ServerError>
        {!failure?.stateChanged && (
          <>
            <PasswordField
              id={`${id}-password`}
              registration={register("password")}
              error={errors.password?.message}
              serverErrorId={serverErrorId}
            />
            <CodeField
              id={`${id}-code`}
              mode={mode}
              onModeChange={changeMode}
              allowRecovery
              registration={register("code")}
              error={errors.code?.message}
              serverErrorId={serverErrorId}
            />
          </>
        )}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <DialogClose asChild>
            <Button variant="outline" disabled={isSubmitting}>
              {failure?.stateChanged ? "Cerrá" : "Cancelá"}
            </Button>
          </DialogClose>
          {!failure?.stateChanged && (
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {isSubmitting ? "Desactivando…" : "Desactivá la verificación"}
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
