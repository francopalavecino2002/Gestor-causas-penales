import { useId, useState } from "react";
import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FieldError } from "@/components/ui/field";
import { templateUrl } from "@/features/imports/import-api";
import { IMPORT_KINDS } from "@/features/imports/import-copy";
import { StepHeading } from "@/features/imports/import-stepper";
import type { ImportKind } from "@/features/imports/import-types";
import { cn } from "@/lib/utils";

/**
 * Step 1: what the file contains. The three kinds sit on a numbered rail because the order
 * matters: a case finds its defendants among the persons, a hearing finds its case.
 */
export function KindStep({
  value,
  focusOnMount,
  onChange,
  onContinue,
}: {
  value: ImportKind | null;
  focusOnMount: boolean;
  onChange: (kind: ImportKind) => void;
  onContinue: () => void;
}) {
  const titleId = useId();
  const orderId = useId();
  const errorId = useId();
  const [missing, setMissing] = useState(false);

  return (
    <section aria-labelledby={titleId} className="grid gap-5">
      <div className="grid gap-1.5">
        <StepHeading id={titleId} focusOnMount={focusOnMount}>
          ¿Qué vas a importar?
        </StepHeading>
        <p id={orderId} className="max-w-prose text-body text-muted-foreground">
          Importá en este orden: primero las personas, después las causas y al final las audiencias.
          Así cada causa encuentra a sus imputados y cada audiencia, su causa.
        </p>
      </div>

      <form
        noValidate
        className="grid gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (value) onContinue();
          else setMissing(true);
        }}
      >
        <fieldset
          aria-describedby={missing && !value ? `${orderId} ${errorId}` : orderId}
          className="grid gap-3"
        >
          <legend className="sr-only">Qué vas a importar</legend>
          <ol className="grid">
            {IMPORT_KINDS.map((option, index) => {
              const last = index === IMPORT_KINDS.length - 1;
              const checked = value === option.kind;
              return (
                <li key={option.kind} className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3">
                  <div
                    aria-hidden="true"
                    className="grid grid-rows-[auto_1fr] justify-items-center"
                  >
                    <span
                      className={cn(
                        "mt-3.5 inline-flex size-9 items-center justify-center rounded-full border-2 text-meta font-bold tabular-nums transition-colors duration-fast ease-out",
                        checked
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border-strong bg-card text-muted-foreground",
                      )}
                    >
                      {index + 1}
                    </span>
                    {!last && <span className="mt-1 w-0.5 bg-border" />}
                  </div>
                  <div className={cn("grid gap-1", !last && "pb-4")}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-xl border bg-card px-4 pt-3.5 pb-4 transition-colors duration-fast ease-out hover:border-border-strong",
                        checked && "border-primary bg-accent hover:border-primary",
                      )}
                    >
                      <input
                        type="radio"
                        name="import-kind"
                        value={option.kind}
                        checked={checked}
                        onChange={() => {
                          setMissing(false);
                          onChange(option.kind);
                        }}
                        className="mt-1 size-5 shrink-0 cursor-pointer accent-primary"
                      />
                      <span className="grid gap-0.5">
                        <span className="text-card-title font-bold">{option.title}</span>
                        <span className="text-meta text-muted-foreground">
                          {option.description}
                        </span>
                        {option.columnNote && (
                          <span className="text-small text-muted-foreground">
                            {option.columnNote}
                          </span>
                        )}
                      </span>
                    </label>
                    <a
                      href={templateUrl(option.kind)}
                      download
                      className="inline-flex min-h-11 w-fit items-center gap-2 rounded-lg px-1 text-meta font-semibold text-primary underline-offset-4 hover:underline"
                    >
                      <Download aria-hidden="true" className="size-5 shrink-0" />
                      Descargá la plantilla de {option.title.toLowerCase()}
                    </a>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="max-w-prose text-small text-muted-foreground">
            Cada plantilla trae los encabezados y una fila de ejemplo ficticia: reemplazala por tus
            datos antes de subirla.
          </p>
          {missing && !value && (
            <FieldError id={errorId} role="alert">
              Elegí qué vas a importar.
            </FieldError>
          )}
        </fieldset>

        <Button type="submit" size="lg" className="w-full sm:w-fit">
          Continuá
        </Button>
      </form>
    </section>
  );
}
