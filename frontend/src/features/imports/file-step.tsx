import { useId, useState, type DragEvent } from "react";
import { ChevronDown, ChevronLeft, CircleAlert, FileUp, LoaderCircle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { templateUrl } from "@/features/imports/import-api";
import {
  ACCEPT_ATTRIBUTE,
  fileProblem,
  MAX_DATA_ROWS,
  type ImportKindOption,
} from "@/features/imports/import-copy";
import type { ImportProblem } from "@/features/imports/import-errors";
import { StepHeading } from "@/features/imports/import-stepper";
import { cn } from "@/lib/utils";

/** What went wrong with the file: from this screen's checks or from the server's. */
function FileProblemAlert({
  option,
  problem,
}: {
  option: ImportKindOption;
  problem: ImportProblem;
}) {
  return (
    <Alert variant="error" role="alert">
      <CircleAlert aria-hidden="true" />
      <AlertTitle>{problem.title}</AlertTitle>
      <AlertDescription>
        <p>{problem.message}</p>
        {problem.headers.length > 0 && (
          <>
            <p>Revisá estos encabezados:</p>
            <ul className="flex flex-wrap gap-1.5 pt-0.5">
              {problem.headers.map((header) => (
                <li
                  key={header}
                  className="rounded-md border bg-secondary px-2 py-0.5 text-small font-semibold wrap-anywhere"
                >
                  {header}
                </li>
              ))}
            </ul>
            <p>
              Los encabezados correctos están en la{" "}
              <a
                href={templateUrl(option.kind)}
                download
                className="font-semibold text-primary underline underline-offset-4"
              >
                plantilla de {option.title.toLowerCase()}
              </a>
              .
            </p>
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}

/**
 * Step 2: choose or drop the file. A valid file goes straight to the check (a dry run that saves
 * nothing); a file that cannot be valid (type, size) never leaves the device.
 */
export function FileStep({
  option,
  focusOnMount,
  checking,
  serverProblem,
  onFile,
  onBack,
}: {
  option: ImportKindOption;
  focusOnMount: boolean;
  /** The file being checked, while the dry run runs. */
  checking: File | null;
  serverProblem: ImportProblem | null;
  onFile: (file: File) => void;
  onBack: () => void;
}) {
  const titleId = useId();
  const inputId = useId();
  const promptId = useId();
  const hintId = useId();
  const [dragging, setDragging] = useState(false);
  const [localProblem, setLocalProblem] = useState<ImportProblem | null>(null);
  const problem = localProblem ?? serverProblem;

  const take = (file: File | undefined) => {
    if (!file) return;
    const wrong = fileProblem(file);
    if (wrong) {
      setLocalProblem({ title: "No podemos usar ese archivo", message: wrong, headers: [] });
      return;
    }
    setLocalProblem(null);
    onFile(file);
  };

  const onDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!checking) take(event.dataTransfer.files[0]);
  };

  return (
    <section aria-labelledby={titleId} className="grid gap-5">
      <div className="grid gap-1.5">
        <StepHeading id={titleId} focusOnMount={focusOnMount}>
          Subí la planilla de {option.title.toLowerCase()}
        </StepHeading>
        <p className="max-w-prose text-body text-muted-foreground">
          Usá la plantilla o una planilla con los mismos encabezados. Primero la revisamos fila por
          fila; no se guarda nada hasta que confirmes.
        </p>
      </div>

      {problem && !checking && <FileProblemAlert option={option} problem={problem} />}

      <label
        htmlFor={inputId}
        data-dragging={dragging || undefined}
        aria-busy={checking ? true : undefined}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "grid min-h-52 cursor-pointer place-content-center justify-items-center gap-2 rounded-xl border-2 border-dashed border-border-strong bg-card px-5 py-8 text-center transition-colors duration-fast ease-out hover:border-primary hover:bg-accent",
          "has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-ring",
          "data-dragging:border-primary data-dragging:bg-accent",
          checking && "pointer-events-none",
        )}
      >
        {checking ? (
          <span role="status" className="grid justify-items-center gap-2">
            <LoaderCircle aria-hidden="true" className="size-8 animate-spin text-primary" />
            <span className="text-card-title font-bold">Revisando la planilla…</span>
            <span className="text-meta break-all text-muted-foreground">{checking.name}</span>
          </span>
        ) : (
          <>
            <FileUp aria-hidden="true" className="size-8 text-primary" />
            <span id={promptId} className="text-card-title font-bold">
              Elegí el archivo
              <span className="hidden font-normal text-muted-foreground lg:inline">
                {" "}
                o arrastralo hasta acá
              </span>
            </span>
            <span id={hintId} className="max-w-prose text-meta text-muted-foreground">
              Planilla .csv o .xlsx, de hasta 2 MB y {MAX_DATA_ROWS} filas.
            </span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          aria-labelledby={checking ? undefined : promptId}
          aria-label={checking ? "Revisando la planilla" : undefined}
          aria-describedby={checking ? undefined : hintId}
          disabled={checking !== null}
          className="sr-only"
          onChange={(event) => {
            take(event.target.files?.[0]);
            // Choosing the same file again after fixing it must fire a new change.
            event.target.value = "";
          }}
        />
      </label>

      <details className="group max-w-prose rounded-xl border bg-card">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-meta font-semibold [&::-webkit-details-marker]:hidden">
          Cómo guardar la planilla desde Excel
          <ChevronDown
            aria-hidden="true"
            className="size-5 shrink-0 text-muted-foreground transition-transform duration-fast ease-out group-open:rotate-180"
          />
        </summary>
        <ul className="grid list-disc gap-1 px-4 pb-4 pl-9 text-meta marker:text-muted-foreground">
          <li>Guardala como «Libro de Excel (.xlsx)» o como «CSV UTF-8».</li>
          <li>La fila 1 tiene que ser la de los encabezados, tal como vienen en la plantilla.</li>
          <li>Fechas como 15/03/2026 y horas como 09:30.</li>
          <li>Las columnas que no uses pueden quedar vacías.</li>
        </ul>
      </details>

      <Button variant="ghost" className="w-fit" disabled={checking !== null} onClick={onBack}>
        <ChevronLeft aria-hidden="true" />
        Elegí otro tipo de planilla
      </Button>
    </section>
  );
}
