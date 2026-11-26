import { useEffect, useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import type { CodeFormInput, CodeFormOutput } from "@/features/auth/login-schemas";
import { SavedStatus } from "@/features/settings/settings-layout";
import { holdOpen, type CloseGuard } from "@/features/two-factor/close-guard";
import { RecoveryCodesPanel } from "@/features/two-factor/recovery-codes-panel";
import { StepTitle } from "@/features/two-factor/two-factor-dialog";
import { twoFactorFailure, type TwoFactorFailure } from "@/features/two-factor/two-factor-errors";
import { CodeField, ServerError } from "@/features/two-factor/two-factor-fields";
import { useRegenerateRecoveryCodes } from "@/features/two-factor/two-factor-queries";
import { codeSchema, type CodeMode } from "@/features/two-factor/two-factor-schemas";

/** Asks for a current code, then shows the ten new codes once, like the enrollment. */
export function RegenerateFlow({
  closeGuardRef,
  onRegenerated,
  onClose,
}: {
  closeGuardRef: CloseGuard;
  onRegenerated: () => void;
  onClose: () => void;
}) {
  const [codes, setCodes] = useState<string[] | null>(null);

  if (codes) {
    return (
      <>
        <DialogHeader>
          <StepTitle focusOnMount>Guardá tus códigos nuevos</StepTitle>
        </DialogHeader>
        <SavedStatus message="Generaste 10 códigos nuevos." />
        <RecoveryCodesPanel codes={codes} closeGuardRef={closeGuardRef} onDone={onClose} replaced />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>¿Generás códigos nuevos?</StepTitle>
        <DialogDescription>
          Te damos 10 códigos nuevos y los que tenés ahora dejan de funcionar, también los que no
          usaste. Para confirmar, escribí el código de tu app.
        </DialogDescription>
      </DialogHeader>
      <CodeForm
        closeGuardRef={closeGuardRef}
        onGenerated={(next) => {
          setCodes(next);
          onRegenerated();
        }}
      />
    </>
  );
}

function CodeForm({
  closeGuardRef,
  onGenerated,
}: {
  closeGuardRef: CloseGuard;
  onGenerated: (codes: string[]) => void;
}) {
  const id = useId();
  const regenerate = useRegenerateRecoveryCodes();
  const [mode, setMode] = useState<CodeMode>("totp");
  const [failure, setFailure] = useState<TwoFactorFailure | null>(null);
  const {
    register,
    handleSubmit,
    setFocus,
    resetField,
    formState: { errors, isSubmitting },
  } = useForm<CodeFormInput, unknown, CodeFormOutput>({
    resolver: zodResolver(codeSchema(mode)),
    defaultValues: { code: "" },
  });

  useEffect(() => {
    setFocus("code");
  }, [setFocus, mode]);

  const changeMode = (next: CodeMode) => {
    setFailure(null);
    resetField("code");
    setMode(next);
  };

  const submit = handleSubmit(async ({ code }) => {
    setFailure(null);
    const release = holdOpen(closeGuardRef);
    try {
      const { recoveryCodes } = await regenerate.mutateAsync(code);
      onGenerated(recoveryCodes);
    } catch (error) {
      const next = twoFactorFailure(error, "regenerate");
      setFailure(next);
      if (next.invalidInput) {
        resetField("code");
        setFocus("code");
      }
    } finally {
      release();
      regenerate.reset();
    }
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <ServerError id={`${id}-server`}>{failure?.message}</ServerError>
      {!failure?.stateChanged && (
        <CodeField
          id={`${id}-code`}
          mode={mode}
          onModeChange={changeMode}
          allowRecovery
          registration={register("code")}
          error={errors.code?.message}
          serverErrorId={failure?.invalidInput ? `${id}-server` : undefined}
        />
      )}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose asChild>
          <Button variant="outline" disabled={isSubmitting}>
            Cancelá
          </Button>
        </DialogClose>
        {!failure?.stateChanged && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <LoaderCircle aria-hidden="true" className="animate-spin" />}
            {isSubmitting ? "Generando…" : "Generá los códigos nuevos"}
          </Button>
        )}
      </div>
    </form>
  );
}
