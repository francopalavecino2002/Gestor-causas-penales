import { useId } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Hourglass } from "lucide-react";

import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { FIRM_TIME_ZONE } from "@/features/agenda/agenda-dates";
import { useAgendaCache } from "@/features/agenda/agenda-queries";
import { CasesEmpty, LoadError } from "@/features/cases/case-states";
import { countDeadlines, deadlinesSummary } from "@/features/deadlines/deadline-format";
import { DeadlineGroups, DeadlinesSkeleton } from "@/features/deadlines/deadline-groups";
import { useUpcomingDeadlines } from "@/features/deadlines/deadline-queries";
import {
  HORIZONS,
  horizonOf,
  horizonSearch,
  type DeadlineSearch,
  type Horizon,
} from "@/features/deadlines/deadline-search";
import { cn } from "@/lib/utils";

/** Segmented "7 / 15 / 30 / 60 días": toggle buttons, since each one changes the URL. */
function HorizonSwitch({
  horizon,
  onChange,
}: {
  horizon: Horizon;
  onChange: (horizon: Horizon) => void;
}) {
  const labelId = useId();
  return (
    <div className="grid gap-1.5">
      <span id={labelId} className="text-meta font-semibold">
        Horizonte
      </span>
      <div
        role="group"
        aria-labelledby={labelId}
        className="inline-flex w-fit rounded-lg border bg-secondary p-0.75"
      >
        {HORIZONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={horizon === option}
            onClick={() => onChange(option)}
            className={cn(
              "inline-flex min-h-11 cursor-pointer items-center justify-center rounded-md px-3.5 text-meta font-semibold whitespace-nowrap text-muted-foreground tabular-nums transition-colors duration-fast ease-out hover:text-foreground focus-visible:-outline-offset-3",
              "aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-segment",
            )}
          >
            {option} días
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * `/plazos`: the deadlines that need attention across the cases the user sees (ADR-0025):
 * overdue, due within the horizon (`?dias`, 30 by default) and the ones that cannot be counted,
 * grouped by urgency, people deprived of liberty first. `?detenidos=si` keeps only theirs.
 */
export function DeadlinesPage({ search }: { search: DeadlineSearch }) {
  const navigate = useNavigate();
  const switchId = useId();
  const horizon = horizonOf(search);
  const onlyDetained = search.detenidos === "si";
  const deadlines = useUpcomingDeadlines(horizon);
  const timeZone = useAgendaCache().timeZone ?? FIRM_TIME_ZONE;

  const go = (next: DeadlineSearch) => void navigate({ to: "/plazos", search: next });

  const all = deadlines.data ?? [];
  const shown = onlyDetained ? all.filter((deadline) => deadline.rule.detainee) : all;
  const detained = all.filter((deadline) => deadline.rule.detainee).length;
  // Showing the horizon that is on screen, not the one being loaded.
  const loadedHorizon = deadlines.isPlaceholderData ? undefined : horizon;
  const wider = HORIZONS.find((option) => option > horizon);

  return (
    <>
      <PageHeader title="Plazos">
        <p aria-live="polite" className="empty:hidden">
          {deadlines.data && loadedHorizon
            ? deadlinesSummary({
                count: shown.length,
                detained,
                days: loadedHorizon,
                onlyDetained,
              })
            : null}
        </p>
      </PageHeader>

      <div className="grid gap-4">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <HorizonSwitch horizon={horizon} onChange={(next) => go(horizonSearch(search, next))} />
          <div className="flex min-h-11 items-center gap-3">
            <Switch
              id={switchId}
              checked={onlyDetained}
              onCheckedChange={(checked) =>
                go({ ...search, detenidos: checked ? "si" : undefined })
              }
            />
            <Label htmlFor={switchId} className="cursor-pointer">
              Solo personas detenidas
            </Label>
          </div>
        </div>
        <p className="max-w-prose text-small text-muted-foreground">
          Ves los vencidos, los que vencen en los próximos {horizon} días y los que no se pueden
          calcular. Los cumplidos y los suspendidos están en cada causa.
        </p>
      </div>

      {deadlines.isPending ? (
        <DeadlinesSkeleton />
      ) : deadlines.isError ? (
        <LoadError
          title="No pudimos cargar los plazos"
          error={deadlines.error}
          onRetry={() => void deadlines.refetch()}
        />
      ) : shown.length === 0 ? (
        onlyDetained && all.length > 0 ? (
          <CasesEmpty
            title={`No hay plazos de personas detenidas en los próximos ${horizon} días`}
            description={`En este horizonte hay ${countDeadlines(all.length)} que no son de personas detenidas.`}
            icon={Hourglass}
          >
            <Button variant="outline" onClick={() => go({ ...search, detenidos: undefined })}>
              Mostrá todos los plazos
            </Button>
          </CasesEmpty>
        ) : (
          <CasesEmpty
            title={
              onlyDetained
                ? `No hay plazos de personas detenidas en los próximos ${horizon} días`
                : `No hay plazos en los próximos ${horizon} días`
            }
            description="Tampoco hay plazos vencidos ni sin calcular. Los plazos se cargan en cada causa y acá ves los que se acercan."
            icon={Hourglass}
          >
            {wider && (
              <Button variant="outline" onClick={() => go(horizonSearch(search, wider))}>
                Mirá los próximos {wider} días
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link to="/causas">Abrí las causas</Link>
            </Button>
          </CasesEmpty>
        )
      ) : (
        <div
          aria-busy={deadlines.isPlaceholderData}
          className={cn(
            "transition-opacity duration-fast ease-out",
            deadlines.isPlaceholderData && "opacity-60",
          )}
        >
          <DeadlineGroups deadlines={shown} timeZone={timeZone} />
        </div>
      )}
    </>
  );
}
