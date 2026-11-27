import { useState, type ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MAX } from "@/features/auth/login-schemas";

/** The ids that describe a field: its help, its own error and the server's, when they apply. */
function describedBy(...ids: (string | false | undefined)[]): string | undefined {
  const present = ids.filter(Boolean);
  return present.length > 0 ? present.join(" ") : undefined;
}

/** A password field with its own label and a button to show what was typed. */
export function SecretField({
  id,
  label,
  toggleLabel,
  autoComplete,
  registration,
  error,
  serverErrorId,
  help,
}: {
  id: string;
  label: string;
  /** The eye button's name, e.g. "Mostrar la contraseña nueva". */
  toggleLabel: string;
  autoComplete: "current-password" | "new-password";
  registration: UseFormRegisterReturn;
  error: string | undefined;
  /** Set when the server rejected this value: the field is marked and points at the message. */
  serverErrorId?: string;
  help?: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
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
          aria-label={toggleLabel}
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
