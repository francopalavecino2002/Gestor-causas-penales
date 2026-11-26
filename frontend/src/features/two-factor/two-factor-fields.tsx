import { useState, type ReactNode } from "react";
import { CircleAlert, Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CODE_MAX, PASSWORD_MAX } from "@/features/auth/login-schemas";
import type { CodeMode } from "@/features/two-factor/two-factor-schemas";
import { cn } from "@/lib/utils";

/** What the server answered, said in words above the form; fields point at it when it is theirs. */
export function ServerError({ id, children }: { id: string; children: ReactNode }) {
  if (!children) return null;
  return (
    <Alert id={id} variant="error" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}

/** The ids that describe a field: its help, its own error and the server's, when they apply. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(" ") : undefined;
}

export function PasswordField({
  id,
  registration,
  error,
  serverErrorId,
  help,
}: {
  id: string;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  /** Set when the server rejected the password: the field is marked and points at the message. */
  serverErrorId?: string;
  help?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field>
      <Label htmlFor={id}>Tu contraseña</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="current-password"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={PASSWORD_MAX}
          className="pr-12"
          aria-invalid={error || serverErrorId ? true : undefined}
          aria-describedby={describedBy(
            help !== undefined && `${id}-help`,
            error && `${id}-error`,
            serverErrorId,
          )}
          {...registration}
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-0 right-0 text-muted-foreground"
          aria-label="Mostrar contraseña"
          aria-pressed={shown}
          aria-controls={id}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
        </Button>
      </div>
      {help !== undefined && <FieldDescription id={`${id}-help`}>{help}</FieldDescription>}
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </Field>
  );
}

/**
 * A code from the authenticator app (6 numbers, numeric keyboard) or, when `allowRecovery`, a
 * recovery code: a link switches between them, as in the login.
 */
export function CodeField({
  id,
  mode,
  onModeChange,
  registration,
  error,
  serverErrorId,
  allowRecovery = false,
}: {
  id: string;
  mode: CodeMode;
  onModeChange?: (mode: CodeMode) => void;
  registration: UseFormRegisterReturn;
  error: string | undefined;
  serverErrorId?: string;
  allowRecovery?: boolean;
}) {
  const isTotp = mode === "totp";
  return (
    <Field>
      <Label htmlFor={id}>{isTotp ? "Código de 6 números" : "Código de recuperación"}</Label>
      <Input
        id={id}
        type="text"
        inputMode={isTotp ? "numeric" : "text"}
        autoComplete={isTotp ? "one-time-code" : "off"}
        autoCapitalize={isTotp ? "none" : "characters"}
        autoCorrect="off"
        spellCheck={false}
        maxLength={isTotp ? 6 : CODE_MAX}
        placeholder={isTotp ? undefined : "XXXX-XXXX-XXXX-XXXX"}
        className={cn("text-title font-bold tabular-nums", isTotp && "max-w-56")}
        aria-invalid={error || serverErrorId ? true : undefined}
        aria-describedby={describedBy(`${id}-help`, error && `${id}-error`, serverErrorId)}
        {...registration}
      />
      <FieldDescription id={`${id}-help`}>
        {isTotp
          ? "Lo muestra tu app de autenticación y cambia cada 30 segundos. Si vence mientras lo escribís, usá el nuevo."
          : "Uno de los códigos que guardaste. Podés escribirlo con o sin guiones; cada uno sirve una sola vez."}
      </FieldDescription>
      <FieldError id={`${id}-error`}>{error}</FieldError>
      {allowRecovery && onModeChange && (
        <Button
          variant="link"
          className="w-fit justify-start px-0"
          onClick={() => onModeChange(isTotp ? "recovery" : "totp")}
        >
          {isTotp ? "Usá un código de recuperación" : "Usá el código de la app"}
        </Button>
      )}
    </Field>
  );
}
