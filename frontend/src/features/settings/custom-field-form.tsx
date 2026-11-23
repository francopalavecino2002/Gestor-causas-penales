import { useId } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CircleAlert, LoaderCircle, Plus, ShieldAlert, X } from "lucide-react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  customFieldSchema,
  FIELD_LABEL_MAX,
  type CustomFieldFormInput,
  type CustomFieldFormOutput,
} from "@/features/settings/custom-field-schema";
import {
  ENTITY_TARGETS,
  FIELD_TYPE_LABELS,
  FIELD_TYPES,
} from "@/features/settings/settings-copy";
import { settingsErrorMessage } from "@/features/settings/settings-errors";
import { useCreateCustomField, useUpdateCustomField } from "@/features/settings/settings-queries";
import type { CustomField, CustomFieldEntity } from "@/features/settings/settings-types";
import { cn } from "@/lib/utils";

/** Ley 25.326 (arts. 2 and 7): the change history keeps the values in clear (ADR-0018). */
function SensitiveDataWarning() {
  return (
    <Alert variant="deadline">
      <ShieldAlert aria-hidden="true" />
      <AlertTitle>No crees campos para datos sensibles</AlertTitle>
      <AlertDescription>
        Antecedentes penales, salud, origen étnico, religión u opiniones políticas no van en un
        campo propio: el historial de cambios guarda los valores tal cual (Ley 25.326, arts. 2 y 7).
      </AlertDescription>
    </Alert>
  );
}

/**
 * Creates a field (`field` undefined) or edits one. Entity and type never change once created,
 * and saved options cannot be removed, only hidden, so the stored values stay valid.
 */
export function CustomFieldDialog({
  entity,
  field,
  onClose,
  onSaved,
}: {
  entity: CustomFieldEntity;
  field?: CustomField;
  onClose: () => void;
  onSaved: (label: string) => void;
}) {
  const formId = useId();
  const create = useCreateCustomField();
  const update = useUpdateCustomField();
  const mutation = field ? update : create;

  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors },
  } = useForm<CustomFieldFormInput, unknown, CustomFieldFormOutput>({
    resolver: zodResolver(customFieldSchema),
    defaultValues: field
      ? {
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options.map((option) => ({ ...option })),
        }
      : { label: "", type: "TEXT", required: false, options: [] },
  });
  const options = useFieldArray({ control, name: "options" });
  const type = useWatch({ control, name: "type" });
  const optionsError = errors.options?.root?.message ?? errors.options?.message;

  const submit = handleSubmit((values) => {
    const done = {
      onSuccess: (saved: CustomField) => {
        onSaved(saved.label);
        onClose();
      },
    };
    const listOptions = values.type === "LIST" ? values.options : [];
    if (field) {
      update.mutate(
        {
          id: field.id,
          change: {
            label: values.label,
            required: values.required,
            position: field.position,
            options: listOptions.map(({ code, label, hidden }) =>
              code ? { code, label, hidden } : { label, hidden },
            ),
          },
        },
        done,
      );
    } else {
      create.mutate(
        {
          entity,
          label: values.label,
          type: values.type,
          required: values.required,
          options: listOptions.map(({ label }) => ({ label })),
        },
        done,
      );
    }
  });

  const addOption = () => {
    options.append({ code: "", label: "", hidden: false }, { shouldFocus: false });
    // Focus after render: the new input does not exist yet.
    requestAnimationFrame(() => setFocus(`options.${options.fields.length}.label`));
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {field ? "Editá el campo" : `Agregá un campo a ${ENTITY_TARGETS[entity]}`}
          </DialogTitle>
          <DialogDescription>
            {field
              ? `Es un campo de tipo ${FIELD_TYPE_LABELS[field.type].toLocaleLowerCase("es-AR")}; el tipo no se cambia, así los datos ya cargados siguen valiendo.`
              : "Aparece en la ficha de cada uno, para todo el estudio."}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} noValidate onSubmit={submit} className="grid gap-5">
          {!field && <SensitiveDataWarning />}
          {mutation.isError && (
            <Alert variant="error" role="alert">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{settingsErrorMessage(mutation.error)}</AlertDescription>
            </Alert>
          )}

          <Field>
            <Label htmlFor={`${formId}-label`}>Nombre del campo</Label>
            <Input
              id={`${formId}-label`}
              maxLength={FIELD_LABEL_MAX}
              aria-invalid={errors.label ? true : undefined}
              aria-describedby={errors.label ? `${formId}-label-error` : undefined}
              {...register("label")}
            />
            <FieldError id={`${formId}-label-error`}>{errors.label?.message}</FieldError>
          </Field>

          {!field && (
            <fieldset className="grid gap-2">
              <legend className="mb-1.5 text-body font-semibold">Tipo de dato</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {FIELD_TYPES.map((option) => (
                  <label
                    key={option.type}
                    className={cn(
                      "flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border bg-card px-3.5 py-2.5 transition-colors duration-fast ease-out hover:bg-accent",
                      "has-checked:border-primary has-checked:bg-accent has-focus-visible:outline-3 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                    )}
                  >
                    <input
                      type="radio"
                      value={option.type}
                      className="mt-1 size-4.5 shrink-0 accent-primary focus-visible:outline-none"
                      {...register("type", {
                        // A list starts with one empty option to fill in.
                        onChange: (event: { target: { value: string } }) => {
                          if (event.target.value === "LIST" && options.fields.length === 0) {
                            options.append({ code: "", label: "", hidden: false }, { shouldFocus: false });
                          }
                        },
                      })}
                    />
                    <span className="grid gap-0.5">
                      <span className="text-body font-semibold">{option.label}</span>
                      <span className="text-small text-muted-foreground">{option.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
              <FieldDescription>El tipo no se puede cambiar después.</FieldDescription>
            </fieldset>
          )}

          {type === "LIST" && (
            <fieldset
              className="grid gap-3"
              aria-describedby={optionsError ? `${formId}-options-error` : undefined}
            >
              <legend className="mb-1.5 text-body font-semibold">Opciones</legend>
              {field && (
                <FieldDescription>
                  Una opción guardada no se borra: si ya no se usa, ocultala. Las causas que la
                  tienen la conservan.
                </FieldDescription>
              )}
              <ol className="grid gap-3">
                {options.fields.map((option, index) => {
                  const inputId = `${formId}-option-${index}`;
                  const error = errors.options?.[index]?.label?.message;
                  const saved = Boolean(option.code);
                  return (
                    <li key={option.id} className="grid gap-1.5">
                      <Label htmlFor={inputId} className="text-meta">
                        Opción {index + 1}
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={inputId}
                          maxLength={FIELD_LABEL_MAX}
                          aria-invalid={error ? true : undefined}
                          aria-describedby={error ? `${inputId}-error` : undefined}
                          {...register(`options.${index}.label`)}
                        />
                        {saved ? (
                          <Controller
                            control={control}
                            name={`options.${index}.hidden`}
                            render={({ field: hidden }) => (
                              <span className="flex min-h-11 shrink-0 items-center gap-2 pl-1">
                                <Checkbox
                                  id={`${inputId}-hidden`}
                                  checked={hidden.value}
                                  onCheckedChange={(checked) => hidden.onChange(checked === true)}
                                />
                                <Label htmlFor={`${inputId}-hidden`} className="cursor-pointer">
                                  Oculta
                                </Label>
                              </span>
                            )}
                          />
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Quitá la opción ${index + 1}`}
                            onClick={() => options.remove(index)}
                          >
                            <X aria-hidden="true" />
                          </Button>
                        )}
                      </div>
                      <FieldError id={`${inputId}-error`}>{error}</FieldError>
                    </li>
                  );
                })}
              </ol>
              <FieldError id={`${formId}-options-error`}>{optionsError}</FieldError>
              <Button variant="outline" className="w-fit" onClick={addOption}>
                <Plus aria-hidden="true" />
                Agregá una opción
              </Button>
            </fieldset>
          )}

          <Controller
            control={control}
            name="required"
            render={({ field: required }) => (
              <div className="grid gap-1">
                <div className="flex min-h-11 items-center gap-3">
                  <Checkbox
                    id={`${formId}-required`}
                    checked={required.value}
                    onCheckedChange={(checked) => required.onChange(checked === true)}
                    aria-describedby={`${formId}-required-help`}
                  />
                  <Label htmlFor={`${formId}-required`} className="cursor-pointer">
                    Es obligatorio completarlo
                  </Label>
                </div>
                <FieldDescription id={`${formId}-required-help`}>
                  Se pide al cargar una ficha nueva o al editar sus campos propios.
                </FieldDescription>
              </div>
            )}
          />

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelá</Button>
            </DialogClose>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {mutation.isPending ? "Guardando…" : field ? "Guardá los cambios" : "Agregá el campo"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
