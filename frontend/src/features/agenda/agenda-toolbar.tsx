import { useId } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { LawyerOption } from "@/features/agenda/agenda-format";
import type { AgendaViewMode } from "@/features/agenda/agenda-search";
import { cn } from "@/lib/utils";

const VIEWS: { value: AgendaViewMode; label: string }[] = [
  { value: "dia", label: "Día" },
  { value: "semana", label: "Semana" },
];

/** Segmented "Día / Semana" switch: toggle buttons, so screen readers hear which one is on. */
function ViewSwitch({
  view,
  onChange,
}: {
  view: AgendaViewMode;
  onChange: (view: AgendaViewMode) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Vista de la agenda"
      className="inline-flex rounded-lg border bg-secondary p-0.75"
    >
      {VIEWS.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-4 text-meta font-semibold text-muted-foreground transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3",
            "aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-segment",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** View switch, previous / today / next, and the lawyer filter. */
export function AgendaToolbar({
  view,
  onViewChange,
  onPrevious,
  onToday,
  onNext,
  lawyer,
  lawyerOptions,
  onLawyerChange,
}: {
  view: AgendaViewMode;
  onViewChange: (view: AgendaViewMode) => void;
  onPrevious: () => void;
  onToday: () => void;
  onNext: () => void;
  lawyer: string;
  lawyerOptions: LawyerOption[];
  onLawyerChange: (lawyerId: string) => void;
}) {
  const selectId = useId();
  const unit = view === "dia" ? "Día" : "Semana";
  return (
    <div className="flex flex-wrap items-end gap-3">
      <ViewSwitch view={view} onChange={onViewChange} />
      <div role="group" aria-label="Cambiar de fecha" className="flex gap-2">
        <Button variant="outline" size="icon" aria-label={`${unit} anterior`} onClick={onPrevious}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <Button variant="outline" onClick={onToday}>
          Hoy
        </Button>
        <Button variant="outline" size="icon" aria-label={`${unit} siguiente`} onClick={onNext}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <div className="grid w-full gap-1.5 sm:w-64">
        <Label htmlFor={selectId}>Abogado o abogada</Label>
        <Select
          id={selectId}
          value={lawyer}
          onChange={(event) => onLawyerChange(event.target.value)}
        >
          {lawyerOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
