import { useId } from "react";
import { Link } from "@tanstack/react-router";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createdLabel, nextKind, type ImportKindOption } from "@/features/imports/import-copy";
import { StepHeading } from "@/features/imports/import-stepper";
import type { ImportReport } from "@/features/imports/import-types";

/** Step 4: what was saved, where to see it and the next kind in the recommended order. */
export function DoneStep({
  option,
  report,
  onNext,
  onRestart,
}: {
  option: ImportKindOption;
  report: ImportReport;
  onNext: (next: ImportKindOption) => void;
  onRestart: () => void;
}) {
  const titleId = useId();
  const next = nextKind(option.kind);
  const created = createdLabel(report.created);

  return (
    <section aria-labelledby={titleId} className="grid gap-5">
      <div className="grid gap-3 rounded-xl border border-l-6 border-l-status-efectiva bg-card px-4 pt-3.5 pb-4">
        <div className="flex items-start gap-3">
          <CircleCheck aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-status-efectiva" />
          <div className="grid gap-1">
            <StepHeading id={titleId} focusOnMount>
              Listo: importaste {option.plural}
            </StepHeading>
            <p className="text-body">
              {created ? `Se crearon ${created}.` : "No había registros nuevos para crear."}{" "}
              Quedaron en el historial de cambios a tu nombre.
            </p>
          </div>
        </div>
      </div>

      {next && (
        <p className="max-w-prose text-body text-muted-foreground">
          Lo que sigue en el orden recomendado: {next.plural}.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
        <Button asChild size="lg">
          <Link to={option.area.to}>{option.area.label}</Link>
        </Button>
        {next && (
          <Button variant="outline" size="lg" onClick={() => onNext(next)}>
            Importá {next.plural}
          </Button>
        )}
        <Button variant="ghost" size="lg" onClick={onRestart}>
          Importá otra planilla
        </Button>
      </div>
    </section>
  );
}
