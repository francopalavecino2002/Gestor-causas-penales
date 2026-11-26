import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, Search } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { FormSheet } from "@/components/forms/form-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConflictMatches } from "@/features/persons/conflict-matches";
import { useConflictCheck } from "@/features/persons/person-queries";
import { normalizeDocument } from "@/features/persons/person-schema";
import { isApiError, NETWORK_ERROR } from "@/lib/api";

/** The backend takes up to 30 characters once normalized. */
const CHECK_MAX = 30;

const schema = z.object({
  documentNumber: z
    .string()
    .transform(normalizeDocument)
    .pipe(
      z
        .string()
        .min(1, "Escribí el número de documento.")
        .max(CHECK_MAX, `Usá hasta ${CHECK_MAX} letras o números.`),
    ),
});

type Values = z.input<typeof schema>;
type Parsed = z.output<typeof schema>;

/**
 * "Control de conflicto": before taking a case, look a document number up among every person of
 * the firm (archived ones too) and see their roles in cases. The number travels in a POST body,
 * never in the URL, and nothing is stored.
 */
export function ConflictCheckDialog({ onClose }: { onClose: () => void }) {
  const formId = useId();
  const inputId = `${formId}-number`;
  const check = useConflictCheck();
  const form = useForm<Values, unknown, Parsed>({
    resolver: zodResolver(schema),
    defaultValues: { documentNumber: "" },
  });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = form;

  const submit = handleSubmit((values) => check.mutate(values.documentNumber));
  const error = errors.documentNumber?.message;

  return (
    <FormSheet
      title="Control de conflicto"
      description="Buscá un documento entre todas las personas del estudio antes de aceptar un caso."
      onClose={onClose}
      className="sm:max-w-xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Cerrá
        </Button>
      }
    >
      <div className="grid gap-5">
        <form id={formId} noValidate onSubmit={submit} className="grid gap-3">
          <Field>
            <Label htmlFor={inputId}>Número de documento</Label>
            <div className="flex flex-wrap gap-2.5">
              <Input
                id={inputId}
                inputMode="text"
                autoComplete="off"
                maxLength={60}
                className="min-w-0 flex-1 basis-48 tabular-nums"
                aria-invalid={error ? true : undefined}
                aria-describedby={`${inputId}-hint${error ? ` ${inputId}-error` : ""}`}
                // A result belongs to the number it was asked for: editing clears it.
                {...register("documentNumber", { onChange: () => check.reset() })}
              />
              <Button type="submit" disabled={check.isPending}>
                {check.isPending ? (
                  <LoaderCircle
                    aria-hidden="true"
                    className="animate-spin motion-reduce:animate-none"
                  />
                ) : (
                  <Search aria-hidden="true" />
                )}
                Buscá el documento
              </Button>
            </div>
            <FieldDescription id={`${inputId}-hint`}>
              DNI, CUIT, CUIL o pasaporte, con o sin puntos. No queda guardado.
            </FieldDescription>
            <FieldError id={`${inputId}-error`}>{error}</FieldError>
          </Field>
        </form>

        {check.isError && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>
              {isApiError(check.error) && check.error.type === NETWORK_ERROR
                ? "No hay conexión con el servidor. Revisá tu conexión a internet y volvé a buscar."
                : "No pudimos hacer el control. Volvé a intentar en unos minutos."}
            </AlertDescription>
          </Alert>
        )}
        {check.isSuccess && (
          <ConflictMatches matches={check.data.matches} disclaimer={check.data.disclaimer} live />
        )}
      </div>
    </FormSheet>
  );
}
