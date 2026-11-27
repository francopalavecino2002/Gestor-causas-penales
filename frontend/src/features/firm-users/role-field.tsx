import type { UseFormRegisterReturn } from "react-hook-form";

import { Field, FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { Role } from "@/features/auth/auth-api";
import { ROLE_LABELS } from "@/features/auth/roles";
import { ROLE_DESCRIPTIONS, ROLE_ORDER } from "@/features/settings/settings-copy";

/**
 * The role, as a native select, and what the chosen role can do right under it: the owner decides
 * by permissions, not by a title.
 */
export function RoleField({
  id,
  label = "Rol",
  registration,
  value,
  error,
  placeholder,
}: {
  id: string;
  label?: string;
  registration: UseFormRegisterReturn;
  /** The chosen role, to describe it; empty while nothing is chosen. */
  value: Role | "";
  error: string | undefined;
  /** A first, empty option ("Elegí un rol") so the owner picks on purpose. */
  placeholder?: string;
}) {
  const helpId = `${id}-help`;
  const describedBy = [value && helpId, error && `${id}-error`].filter(Boolean).join(" ");
  return (
    <Field>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...registration}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {ROLE_ORDER.map((role) => (
          <option key={role} value={role}>
            {ROLE_LABELS[role]}
          </option>
        ))}
      </Select>
      <FieldError id={`${id}-error`}>{error}</FieldError>
      {value && (
        <div id={helpId} className="grid gap-1.5 rounded-lg border bg-secondary px-4 py-3">
          <p className="text-meta font-semibold">Qué puede hacer el rol {ROLE_LABELS[value]}</p>
          <ul className="grid list-disc gap-1 pl-5 text-meta marker:text-muted-foreground">
            {ROLE_DESCRIPTIONS[value].map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </Field>
  );
}
