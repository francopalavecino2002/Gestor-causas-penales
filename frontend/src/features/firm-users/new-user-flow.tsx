import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { LoaderCircle, UserPlus } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { DialogClose, DialogDescription, DialogHeader } from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Role } from "@/features/auth/auth-api";
import { EMAIL_MAX } from "@/features/auth/login-schemas";
import { firmUserFailure } from "@/features/firm-users/firm-users-errors";
import { useCreateFirmUser } from "@/features/firm-users/firm-users-queries";
import {
  DISPLAY_NAME_MAX,
  newUserSchema,
  type NewUserInput,
  type NewUserOutput,
} from "@/features/firm-users/firm-user-schema";
import { RoleField } from "@/features/firm-users/role-field";
import { TemporaryPasswordPanel } from "@/features/firm-users/temporary-password-panel";
import { SavedStatus } from "@/features/settings/settings-layout";
import { holdOpen, type CloseGuard } from "@/features/two-factor/close-guard";
import { StepTitle } from "@/features/two-factor/two-factor-dialog";
import { ServerError } from "@/features/two-factor/two-factor-fields";

interface Created {
  displayName: string;
  email: string;
  password: string;
}

/**
 * «Sumá una persona»: name, email and role, then the temporary password, once. It lives inside the
 * dialog's content, so the password disappears with it when the dialog closes.
 */
export function NewUserFlow({
  closeGuardRef,
  onCreated,
  onClose,
}: {
  closeGuardRef: CloseGuard;
  /** The account exists: the screen behind can say so. */
  onCreated: (displayName: string) => void;
  onClose: () => void;
}) {
  const [created, setCreated] = useState<Created | null>(null);

  if (created) {
    return (
      <>
        <DialogHeader>
          <StepTitle focusOnMount>Contraseña temporal de {created.displayName}</StepTitle>
        </DialogHeader>
        <SavedStatus message={`Creaste la cuenta de ${created.displayName}.`} />
        <TemporaryPasswordPanel
          password={created.password}
          user={created}
          closeGuardRef={closeGuardRef}
          onDone={onClose}
        />
      </>
    );
  }

  return (
    <>
      <DialogHeader>
        <StepTitle focusOnMount={false}>Sumá una persona al estudio</StepTitle>
        <DialogDescription>
          Creás su cuenta y te damos una contraseña temporal para que se la des. Al ingresar por
          primera vez, elige la suya.
        </DialogDescription>
      </DialogHeader>
      <NewUserForm
        closeGuardRef={closeGuardRef}
        onCreated={(next) => {
          setCreated(next);
          onCreated(next.displayName);
        }}
      />
    </>
  );
}

function NewUserForm({
  closeGuardRef,
  onCreated,
}: {
  closeGuardRef: CloseGuard;
  onCreated: (created: Created) => void;
}) {
  const id = useId();
  const create = useCreateFirmUser();
  const [failure, setFailure] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    control,
    formState: { errors, isSubmitting },
  } = useForm<NewUserInput, unknown, NewUserOutput>({
    resolver: zodResolver(newUserSchema),
    defaultValues: { displayName: "", email: "", role: "" },
  });
  const role = useWatch({ control, name: "role" }) as Role | "";

  const submit = handleSubmit(async (values) => {
    setFailure(null);
    // Closing mid-request could create the account without the password ever reaching the screen.
    const release = holdOpen(closeGuardRef);
    try {
      const answer = await create.mutateAsync(values);
      onCreated({
        displayName: answer.user.displayName,
        email: answer.user.email,
        password: answer.temporaryPassword,
      });
    } catch (error) {
      const next = firmUserFailure(error);
      if (next.duplicateEmail) {
        setError("email", { message: next.message });
        setFocus("email");
      } else {
        setFailure(next.message);
      }
    } finally {
      release();
      // The temporary password lives only in the dialog's state, never in the mutation cache.
      create.reset();
    }
  });

  return (
    <form noValidate onSubmit={submit} className="grid gap-5">
      <ServerError id={`${id}-server`}>{failure}</ServerError>
      <Field>
        <Label htmlFor={`${id}-name`}>Nombre y apellido</Label>
        <Input
          id={`${id}-name`}
          autoComplete="off"
          maxLength={DISPLAY_NAME_MAX}
          aria-invalid={errors.displayName ? true : undefined}
          aria-describedby={errors.displayName ? `${id}-name-error` : undefined}
          {...register("displayName")}
        />
        <FieldError id={`${id}-name-error`}>{errors.displayName?.message}</FieldError>
      </Field>
      <Field>
        <Label htmlFor={`${id}-email`}>Email</Label>
        <Input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={EMAIL_MAX}
          aria-invalid={errors.email ? true : undefined}
          aria-describedby={
            errors.email ? `${id}-email-help ${id}-email-error` : `${id}-email-help`
          }
          {...register("email")}
        />
        <FieldDescription id={`${id}-email-help`}>
          Con este email va a ingresar. No le mandamos nada: la contraseña se la das vos.
        </FieldDescription>
        <FieldError id={`${id}-email-error`}>{errors.email?.message}</FieldError>
      </Field>
      <RoleField
        id={`${id}-role`}
        registration={register("role")}
        value={role}
        error={errors.role?.message}
        placeholder="Elegí un rol"
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <DialogClose asChild>
          <Button variant="outline" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
            Cancelá
          </Button>
        </DialogClose>
        <Button type="submit" size="lg" className="w-full sm:w-fit" disabled={isSubmitting}>
          {isSubmitting ? (
            <LoaderCircle aria-hidden="true" className="animate-spin" />
          ) : (
            <UserPlus aria-hidden="true" />
          )}
          {isSubmitting ? "Creando…" : "Creá la cuenta"}
        </Button>
      </div>
    </form>
  );
}
