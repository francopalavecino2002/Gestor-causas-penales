import { useId, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle } from "lucide-react";
import { useForm } from "react-hook-form";

import { FormSheet } from "@/components/forms/form-sheet";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FIRM_TIME_ZONE, todayIn } from "@/features/agenda/agenda-dates";
import type { ClientView } from "@/features/persons/person-api";
import {
  clientDataOf,
  clientFormSchema,
  clientFormValues,
  clientProblem,
  CONSENT_REF_MAX,
  CONSENT_SCOPE_MAX,
  REFERRAL_MAX,
  type ClientFormField,
  type ClientFormValues,
} from "@/features/persons/person-form-schema";
import { useSaveClient } from "@/features/persons/person-queries";

/**
 * "Registrar como cliente" or, with `client`, its edit: when the person came to the firm, how, and the
 * consent to process their data (Ley 25.326): when it was given, for what, and where the signed
 * form is.
 */
export function ClientFormDialog({
  personId,
  personName,
  client,
  onClose,
}: {
  personId: string;
  personName: string;
  client?: ClientView;
  onClose: () => void;
}) {
  const formId = useId();
  const save = useSaveClient(personId, client?.id ?? null);
  const [general, setGeneral] = useState<string | null>(null);
  const today = todayIn(FIRM_TIME_ZONE);
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientFormSchema),
    defaultValues: clientFormValues(client),
  });
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = form;

  const submit = handleSubmit(async (values) => {
    setGeneral(null);
    try {
      await save.mutateAsync(clientDataOf(values));
      onClose();
    } catch (error) {
      const problem = clientProblem(error);
      let first = true;
      for (const [field, message] of Object.entries(problem.fields)) {
        if (!message) continue;
        setError(field as ClientFormField, { message }, { shouldFocus: first });
        first = false;
      }
      setGeneral(problem.general ?? null);
    }
  });

  const id = (name: ClientFormField) => `${formId}-${name}`;
  const described = (name: ClientFormField, hint = false) =>
    [hint ? `${id(name)}-hint` : null, errors[name] ? `${id(name)}-error` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  const invalid = (name: ClientFormField) => (errors[name] ? true : undefined);

  return (
    <FormSheet
      title={client ? "Editá los datos de cliente" : "Registrar como cliente"}
      description={personName}
      onClose={onClose}
      className="sm:max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelá
          </Button>
          <Button type="submit" form={formId} disabled={isSubmitting}>
            {isSubmitting && (
              <LoaderCircle
                aria-hidden="true"
                className="animate-spin motion-reduce:animate-none"
              />
            )}
            Guardá los datos de cliente
          </Button>
        </>
      }
    >
      <form id={formId} noValidate onSubmit={submit} className="grid gap-5">
        {general && (
          <Alert variant="error" role="alert">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{general}</AlertDescription>
          </Alert>
        )}
        <div className="grid items-start gap-5 sm:grid-cols-2">
          <Field>
            <Label htmlFor={id("intakeDate")}>Llegó al estudio el</Label>
            <Input
              id={id("intakeDate")}
              type="date"
              max={today}
              className="tabular-nums"
              aria-invalid={invalid("intakeDate")}
              aria-describedby={described("intakeDate")}
              {...register("intakeDate")}
            />
            <FieldError id={`${id("intakeDate")}-error`}>{errors.intakeDate?.message}</FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("referralSource")}>Cómo llegó</Label>
            <Input
              id={id("referralSource")}
              maxLength={REFERRAL_MAX}
              autoComplete="off"
              aria-invalid={invalid("referralSource")}
              aria-describedby={described("referralSource", true)}
              {...register("referralSource")}
            />
            <FieldDescription id={`${id("referralSource")}-hint`}>
              Opcional. Por ejemplo: derivado por otro cliente.
            </FieldDescription>
            <FieldError id={`${id("referralSource")}-error`}>
              {errors.referralSource?.message}
            </FieldError>
          </Field>
        </div>

        <fieldset className="grid gap-4 rounded-xl border px-4 pt-3 pb-4">
          <legend className="px-1 text-body font-semibold">
            Consentimiento de tratamiento de datos
          </legend>
          <p className="text-small text-muted-foreground">
            Ley 25.326: anotá cuándo te autorizó a tratar sus datos y para qué. Si todavía no lo
            firmó, dejalo vacío y completalo después.
          </p>
          <Field className="sm:max-w-xs">
            <Label htmlFor={id("consentGivenOn")}>Lo dio el</Label>
            <Input
              id={id("consentGivenOn")}
              type="date"
              max={today}
              className="tabular-nums"
              aria-invalid={invalid("consentGivenOn")}
              aria-describedby={described("consentGivenOn")}
              {...register("consentGivenOn")}
            />
            <FieldError id={`${id("consentGivenOn")}-error`}>
              {errors.consentGivenOn?.message}
            </FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("consentScope")}>Para qué lo dio</Label>
            <Textarea
              id={id("consentScope")}
              rows={2}
              maxLength={CONSENT_SCOPE_MAX}
              className="min-h-20"
              aria-invalid={invalid("consentScope")}
              aria-describedby={described("consentScope", true)}
              {...register("consentScope")}
            />
            <FieldDescription id={`${id("consentScope")}-hint`}>
              Por ejemplo: para su defensa en las causas del estudio.
            </FieldDescription>
            <FieldError id={`${id("consentScope")}-error`}>
              {errors.consentScope?.message}
            </FieldError>
          </Field>
          <Field>
            <Label htmlFor={id("consentDocumentRef")}>Dónde está el formulario firmado</Label>
            <Input
              id={id("consentDocumentRef")}
              maxLength={CONSENT_REF_MAX}
              autoComplete="off"
              aria-invalid={invalid("consentDocumentRef")}
              aria-describedby={described("consentDocumentRef", true)}
              {...register("consentDocumentRef")}
            />
            <FieldDescription id={`${id("consentDocumentRef")}-hint`}>
              Opcional. Una carpeta o una referencia interna.
            </FieldDescription>
            <FieldError id={`${id("consentDocumentRef")}-error`}>
              {errors.consentDocumentRef?.message}
            </FieldError>
          </Field>
        </fieldset>
      </form>
    </FormSheet>
  );
}
