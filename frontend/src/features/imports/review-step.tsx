import { Fragment, useId } from "react";
import {
  ChevronDown,
  CircleAlert,
  CircleCheck,
  FileSpreadsheet,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  createdLabel,
  fileSizeLabel,
  rowsLabel,
  type ImportKindOption,
} from "@/features/imports/import-copy";
import type { ImportProblem } from "@/features/imports/import-errors";
import { StepHeading } from "@/features/imports/import-stepper";
import type { ImportReport, RowResult } from "@/features/imports/import-types";
import { cn } from "@/lib/utils";

/** Rows in the sheet, rows without errors and rows with errors. */
function ReportSummary({ report }: { report: ImportReport }) {
  const items = [
    { label: "Filas en la planilla", value: report.totalRows, alert: false },
    { label: "Sin errores", value: report.validRows, alert: false },
    { label: "Con errores", value: report.errorRows, alert: report.errorRows > 0 },
  ];
  return (
    <dl className="grid grid-cols-3 divide-x overflow-hidden rounded-xl border bg-card">
      {items.map((item) => (
        <div key={item.label} className="grid content-start gap-0.5 px-3 py-3 sm:px-4">
          <dt className="text-small text-muted-foreground">{item.label}</dt>
          <dd
            className={cn(
              "flex items-center gap-1.5 text-display font-bold tabular-nums",
              item.alert && "text-destructive",
            )}
          >
            {item.alert && <CircleAlert aria-hidden="true" className="size-6 shrink-0" />}
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** A header like `numero_documento`, allowed to wrap after each underscore on narrow screens. */
function HeaderName({ name }: { name: string }) {
  const parts = name.split("_");
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part}
      {index < parts.length - 1 && (
        <>
          _<wbr />
        </>
      )}
    </Fragment>
  ));
}

/**
 * Every problem, one line per column, grouped by the row number Excel shows (the header is
 * row 1). Three narrow columns read fine from 360 px; long header names wrap anywhere.
 */
function ErrorTable({ rows }: { rows: RowResult[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="grid gap-2">
      <h3 id={titleId} className="text-card-title font-bold">
        Qué corregir en cada fila
      </h3>
      <div className="overflow-hidden rounded-xl border bg-card">
        <table aria-labelledby={titleId} className="w-full table-fixed text-left text-meta">
          <colgroup>
            <col className="w-14 sm:w-20" />
            <col className="w-[34%] sm:w-56" />
            <col />
          </colgroup>
          <thead className="bg-secondary text-small text-muted-foreground">
            <tr>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                Fila
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                Columna
              </th>
              <th scope="col" className="px-3 py-2.5 font-semibold sm:px-4">
                Problema
              </th>
            </tr>
          </thead>
          {rows.map((row) => {
            const errors =
              row.errors.length > 0
                ? row.errors
                : [{ column: null, message: "La fila tiene un error.", detail: null }];
            return (
              <tbody key={row.row} className="border-t">
                {errors.map((error, index) => (
                  <tr
                    key={`${error.column ?? ""}-${index}`}
                    className={cn(index > 0 && "border-t border-dashed")}
                  >
                    {index === 0 && (
                      <th
                        scope="rowgroup"
                        rowSpan={errors.length}
                        className="px-3 py-3 align-top text-body font-bold tabular-nums sm:px-4"
                      >
                        {row.row}
                      </th>
                    )}
                    <td className="px-3 py-3 align-top font-semibold wrap-anywhere sm:px-4">
                      {error.column ? (
                        <HeaderName name={error.column} />
                      ) : (
                        <span className="font-normal text-muted-foreground">Toda la fila</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-top text-pretty sm:px-4">{error.message}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>
    </section>
  );
}

/** The rows that passed, by their short name, folded: the errors matter more. */
function ValidRows({ rows }: { rows: RowResult[] }) {
  if (rows.length === 0) return null;
  return (
    <details className="group rounded-xl border bg-card">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-4 text-meta font-semibold [&::-webkit-details-marker]:hidden">
        Mirá las {rowsLabel(rows.length)} sin errores
        <ChevronDown
          aria-hidden="true"
          className="size-5 shrink-0 text-muted-foreground transition-transform duration-fast ease-out group-open:rotate-180"
        />
      </summary>
      <ul className="grid gap-1 px-4 pb-4 text-meta">
        {rows.map((row) => (
          <li key={row.row} className="flex gap-3">
            <span className="w-16 shrink-0 text-muted-foreground tabular-nums">Fila {row.row}</span>
            <span className="min-w-0 wrap-anywhere">{row.label ?? "Sin nombre"}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Step 3: the dry run's report. With errors nothing can be saved, and the screen says what to fix
 * and offers the upload again; without errors the user confirms, and only then is it saved.
 */
export function ReviewStep({
  option,
  file,
  report,
  focusOnMount,
  committing,
  rechecking,
  commitProblem,
  canRecheck,
  onConfirm,
  onRecheck,
  onReupload,
}: {
  option: ImportKindOption;
  file: File;
  report: ImportReport;
  focusOnMount: boolean;
  committing: boolean;
  rechecking: boolean;
  commitProblem: ImportProblem | null;
  /** A retry of the check makes sense (the data changed meanwhile, or a transient failure). */
  canRecheck: boolean;
  onConfirm: () => void;
  onRecheck: () => void;
  onReupload: () => void;
}) {
  const titleId = useId();
  const failed = report.rows.filter((row) => row.status === "ERROR");
  const passed = report.rows.filter((row) => row.status === "VALID");
  const busy = committing || rechecking;
  const created = createdLabel(report.created);

  return (
    <section aria-labelledby={titleId} className="grid gap-5">
      <div className="grid gap-1.5">
        <StepHeading id={titleId} focusOnMount={focusOnMount}>
          {report.errorRows > 0
            ? `Hay ${rowsLabel(report.errorRows)} para corregir`
            : report.totalRows === 0
              ? "La planilla no tiene datos"
              : "Revisá antes de guardar"}
        </StepHeading>
        <p className="flex items-start gap-2 text-meta text-muted-foreground">
          <FileSpreadsheet aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <span className="min-w-0 wrap-anywhere">
            Planilla de {option.title.toLowerCase()}: {file.name} ({fileSizeLabel(file.size)})
          </span>
        </p>
      </div>

      <ReportSummary report={report} />

      {commitProblem && (
        <Alert variant="error" role="alert">
          <CircleAlert aria-hidden="true" />
          <AlertTitle>{commitProblem.title}</AlertTitle>
          <AlertDescription>
            <p>{commitProblem.message}</p>
            {canRecheck && (
              <Button
                variant="outline"
                className="mt-2 justify-self-start"
                disabled={busy}
                onClick={onRecheck}
              >
                {rechecking ? (
                  <LoaderCircle aria-hidden="true" className="animate-spin" />
                ) : (
                  <RotateCcw aria-hidden="true" />
                )}
                Revisá la planilla de nuevo
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {report.errorRows > 0 ? (
        <>
          <Alert variant="error">
            <CircleAlert aria-hidden="true" />
            <AlertTitle>
              No se va a guardar nada hasta que corrijas{" "}
              {failed.length === 1 ? "esa fila" : "esas filas"}.
            </AlertTitle>
            <AlertDescription>
              <p>
                Abrí tu planilla, corregí lo que dice la tabla y volvé a subirla. El número de fila
                es el que muestra Excel: la fila 1 es la de los encabezados.
              </p>
              <p>
                Si preferís, borrá esas filas de la planilla, importá el resto y cargalas a mano
                después.
              </p>
            </AlertDescription>
          </Alert>
          <ErrorTable rows={failed} />
          <ValidRows rows={passed} />
          <Button size="lg" className="w-full sm:w-fit" disabled={busy} onClick={onReupload}>
            Subí la planilla corregida
          </Button>
        </>
      ) : report.totalRows === 0 ? (
        <>
          <p className="max-w-prose text-body">
            Encontramos los encabezados, pero ninguna fila con datos. Completá la planilla debajo de
            los encabezados y volvé a subirla.
          </p>
          <Button size="lg" className="w-full sm:w-fit" onClick={onReupload}>
            Subí otra planilla
          </Button>
        </>
      ) : (
        <>
          <div className="grid gap-3 rounded-xl border bg-card px-4 pt-3.5 pb-4">
            <p className="flex items-start gap-2 text-card-title font-bold">
              <CircleCheck
                aria-hidden="true"
                className="mt-0.5 size-5 shrink-0 text-status-efectiva"
              />
              <span>
                Todo en orden:{" "}
                {report.totalRows === 1
                  ? "la fila se puede"
                  : `las ${report.totalRows} filas se pueden`}{" "}
                importar.
              </span>
            </p>
            {created && <p className="text-body">Al confirmar se van a crear {created}.</p>}
            <p className="text-meta text-muted-foreground">
              Hasta que confirmes no se guardó nada. Lo que importes queda en el historial de
              cambios a tu nombre.
            </p>
          </div>
          <ValidRows rows={passed} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button
              size="lg"
              disabled={busy}
              onClick={onConfirm}
              aria-busy={committing || undefined}
            >
              {committing && <LoaderCircle aria-hidden="true" className="animate-spin" />}
              {committing ? "Importando…" : `Confirmá e importá ${rowsLabel(report.validRows)}`}
            </Button>
            <Button variant="outline" size="lg" disabled={busy} onClick={onReupload}>
              Subí otro archivo
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
